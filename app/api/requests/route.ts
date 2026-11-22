import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { AuditAction, Role, RequestPriority, RequestStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  const { user, errorResponse } = requireAuth(req);
  if (errorResponse || !user) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as RequestStatus | null;

    const where: any = {};
    if (status) where.status = status;

    // If Employee, view only own requests
    if (user.role === Role.EMPLOYEE) {
      where.userId = user.userId;
    }

    const requests = await prisma.softwareRequest.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, department: { select: { name: true } } } },
        software: {
          include: {
            vendor: true,
            licenses: {
              include: {
                assignments: {
                  where: { status: 'ACTIVE' },
                  include: {
                    user: { select: { id: true, name: true, email: true } },
                    department: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
        approvals: {
          include: { approvedBy: { select: { name: true, email: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const requestedSoftwareIds = Array.from(new Set(requests.map((r) => r.softwareId)));
    const usageRecords = requestedSoftwareIds.length > 0
      ? await prisma.usageRecord.findMany({
          where: { softwareId: { in: requestedSoftwareIds } },
          orderBy: { lastActiveDate: 'desc' },
        })
      : [];

    const latestUsageMap = new Map<string, typeof usageRecords[0]>();
    for (const u of usageRecords) {
      const key = `${u.userId}:${u.softwareId}`;
      if (!latestUsageMap.has(key)) {
        latestUsageMap.set(key, u);
      }
    }

    const now = new Date();

    const enriched = requests.map((r) => {
      let totalLicenses = 0;
      let activeAssignments = 0;
      let costPerLicense = 0;
      let billingFrequency = 'MONTHLY';

      const idleSeats: {
        assignmentId: string;
        licenseId: string;
        userId: string;
        userName: string;
        userEmail: string;
        departmentName?: string;
        daysInactive: number;
        lastActiveDate: string | null;
      }[] = [];

      for (const lic of r.software.licenses) {
        totalLicenses += lic.totalQuantity;
        activeAssignments += lic.assignments.length;
        costPerLicense = lic.costPerLicense;
        billingFrequency = lic.billingFrequency || 'MONTHLY';

        for (const assign of lic.assignments) {
          if (assign.userId === r.userId) continue; // Don't consider requester's own assignment

          const usage = latestUsageMap.get(`${assign.userId}:${r.softwareId}`);
          let daysInactive = 999;
          let lastActiveStr: string | null = null;

          if (usage && usage.lastActiveDate) {
            daysInactive = Math.max(0, Math.floor((now.getTime() - new Date(usage.lastActiveDate).getTime()) / (1000 * 60 * 60 * 24)));
            lastActiveStr = usage.lastActiveDate.toISOString();
          } else if (assign.assignedDate) {
            daysInactive = Math.max(0, Math.floor((now.getTime() - new Date(assign.assignedDate).getTime()) / (1000 * 60 * 60 * 24)));
          }

          if (daysInactive > 60) {
            idleSeats.push({
              assignmentId: assign.id,
              licenseId: lic.id,
              userId: assign.userId,
              userName: assign.user?.name || 'Assigned User',
              userEmail: assign.user?.email || 'N/A',
              departmentName: assign.department?.name || 'General',
              daysInactive,
              lastActiveDate: lastActiveStr,
            });
          }
        }
      }

      idleSeats.sort((a, b) => b.daysInactive - a.daysInactive);

      const availableQuantity = Math.max(0, totalLicenses - activeAssignments);
      const hasAvailableUnused = availableQuantity > 0;
      const annualSavings = billingFrequency === 'ANNUAL' ? costPerLicense : costPerLicense * 12;
      const monthlySavings = billingFrequency === 'ANNUAL' ? costPerLicense / 12 : costPerLicense;

      let preCheck: {
        type: 'UNASSIGNED_AVAILABLE' | 'IDLE_SEAT_RECLAIMABLE' | 'PURCHASE_REQUIRED';
        recommendedAction: 'ALLOCATE_EXISTING' | 'RECLAIM_AND_ASSIGN' | 'PURCHASE_NEW';
        availableUnusedSeats: number;
        idleSeatsCount: number;
        topIdleSeat: typeof idleSeats[0] | null;
        idleSeats: typeof idleSeats;
        monthlySavings: number;
        annualSavings: number;
        message: string;
      };

      if (hasAvailableUnused) {
        preCheck = {
          type: 'UNASSIGNED_AVAILABLE',
          recommendedAction: 'ALLOCATE_EXISTING',
          availableUnusedSeats: availableQuantity,
          idleSeatsCount: idleSeats.length,
          topIdleSeat: null,
          idleSeats: [],
          monthlySavings: Math.round(monthlySavings),
          annualSavings: Math.round(annualSavings),
          message: `Allocate existing unassigned seat (${availableQuantity} available in pool — ₹0 new procurement cost).`,
        };
      } else if (idleSeats.length > 0) {
        const top = idleSeats[0];
        preCheck = {
          type: 'IDLE_SEAT_RECLAIMABLE',
          recommendedAction: 'RECLAIM_AND_ASSIGN',
          availableUnusedSeats: 0,
          idleSeatsCount: idleSeats.length,
          topIdleSeat: top,
          idleSeats,
          monthlySavings: Math.round(monthlySavings),
          annualSavings: Math.round(annualSavings),
          message: `Reclaim dormant seat from ${top.userName} (inactive for ${top.daysInactive} days) to fulfill request without purchasing new license (Saves ₹${Math.round(annualSavings).toLocaleString('en-IN')}/yr).`,
        };
      } else {
        preCheck = {
          type: 'PURCHASE_REQUIRED',
          recommendedAction: 'PURCHASE_NEW',
          availableUnusedSeats: 0,
          idleSeatsCount: 0,
          topIdleSeat: null,
          idleSeats: [],
          monthlySavings: 0,
          annualSavings: 0,
          message: `No unassigned or >60d idle seats available in software pool — New license procurement required.`,
        };
      }

      return {
        id: r.id,
        softwareId: r.softwareId,
        softwareName: r.software.name,
        category: r.software.category,
        vendorName: r.software.vendor?.name,
        user: r.user,
        priority: r.priority,
        reason: r.reason,
        requiredDate: r.requiredDate,
        status: r.status,
        comments: r.comments,
        createdAt: r.createdAt,
        approvals: r.approvals,
        // Intelligence & Pre-Check
        availableUnusedSeats: availableQuantity,
        hasAvailableUnused,
        idleSeatsCount: idleSeats.length,
        preCheck,
        intelligenceRecommendation: preCheck.message,
      };
    });

    return NextResponse.json({ success: true, count: enriched.length, requests: enriched });
  } catch (error: any) {
    console.error('Error fetching software requests:', error);
    return NextResponse.json({ success: false, error: 'Failed to retrieve requests' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, errorResponse } = requireAuth(req);
  if (errorResponse || !user) return errorResponse;

  try {
    const body = await req.json();
    const { softwareId, priority = RequestPriority.MEDIUM, reason, requiredDate, comments } = body;

    if (!softwareId || !reason) {
      return NextResponse.json(
        { success: false, error: 'Software and business justification reason are required' },
        { status: 400 }
      );
    }

    const sw = await prisma.software.findUnique({
      where: { id: softwareId },
      include: {
        licenses: {
          include: {
            assignments: {
              where: { status: 'ACTIVE' },
              include: {
                user: { select: { id: true, name: true, email: true } },
                department: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!sw) {
      return NextResponse.json({ success: false, error: 'Software not found' }, { status: 404 });
    }

    const usageRecords = await prisma.usageRecord.findMany({
      where: { softwareId },
      orderBy: { lastActiveDate: 'desc' },
    });
    const latestUsageMap = new Map<string, typeof usageRecords[0]>();
    for (const u of usageRecords) {
      if (!latestUsageMap.has(u.userId)) {
        latestUsageMap.set(u.userId, u);
      }
    }

    const now = new Date();
    let totalQty = 0;
    let activeQty = 0;
    let costPerLicense = 0;
    let billingFrequency = 'MONTHLY';
    const idleSeats: any[] = [];

    for (const lic of sw.licenses) {
      totalQty += lic.totalQuantity;
      activeQty += lic.assignments.length;
      costPerLicense = lic.costPerLicense;
      billingFrequency = lic.billingFrequency || 'MONTHLY';

      for (const assign of lic.assignments) {
        if (assign.userId === user.userId) continue;

        const usage = latestUsageMap.get(assign.userId);
        let daysInactive = 999;
        let lastActiveStr: string | null = null;

        if (usage && usage.lastActiveDate) {
          daysInactive = Math.max(0, Math.floor((now.getTime() - new Date(usage.lastActiveDate).getTime()) / (1000 * 60 * 60 * 24)));
          lastActiveStr = usage.lastActiveDate.toISOString();
        } else if (assign.assignedDate) {
          daysInactive = Math.max(0, Math.floor((now.getTime() - new Date(assign.assignedDate).getTime()) / (1000 * 60 * 60 * 24)));
        }

        if (daysInactive > 60) {
          idleSeats.push({
            assignmentId: assign.id,
            licenseId: lic.id,
            userId: assign.userId,
            userName: assign.user?.name || 'Assigned User',
            daysInactive,
            lastActiveDate: lastActiveStr,
          });
        }
      }
    }

    idleSeats.sort((a, b) => b.daysInactive - a.daysInactive);
    const available = Math.max(0, totalQty - activeQty);
    const annualSavings = billingFrequency === 'ANNUAL' ? costPerLicense : costPerLicense * 12;

    let preCheck: any;
    if (available > 0) {
      preCheck = {
        type: 'UNASSIGNED_AVAILABLE',
        recommendedAction: 'ALLOCATE_EXISTING',
        availableUnusedSeats: available,
        idleSeatsCount: idleSeats.length,
        message: `System detected ${available} unassigned seat(s) in pool. An existing license will be allocated immediately upon approval.`,
      };
    } else if (idleSeats.length > 0) {
      const top = idleSeats[0];
      preCheck = {
        type: 'IDLE_SEAT_RECLAIMABLE',
        recommendedAction: 'RECLAIM_AND_ASSIGN',
        availableUnusedSeats: 0,
        idleSeatsCount: idleSeats.length,
        topIdleSeat: top,
        annualSavings,
        message: `Pre-check detected ${idleSeats.length} dormant seat(s) (>60d inactive, e.g. ${top.userName} — ${top.daysInactive}d inactive). Reclaiming can fulfill your request without procurement!`,
      };
    } else {
      preCheck = {
        type: 'PURCHASE_REQUIRED',
        recommendedAction: 'PURCHASE_NEW',
        availableUnusedSeats: 0,
        idleSeatsCount: 0,
        message: `Request submitted for managerial review. No unused or dormant seats currently available in pool.`,
      };
    }

    const request = await prisma.softwareRequest.create({
      data: {
        userId: user.userId,
        softwareId,
        priority,
        reason: reason.trim(),
        requiredDate: requiredDate ? new Date(requiredDate) : null,
        comments,
        status: RequestStatus.PENDING,
      },
    });

    await recordAuditLog({
      userId: user.userId,
      action: AuditAction.REQUEST_SUBMITTED,
      entity: 'SoftwareRequest',
      entityId: request.id,
      details: {
        softwareName: sw.name,
        availableSeatsDetected: available,
        idleSeatsDetected: idleSeats.length,
        preCheckType: preCheck.type,
        priority,
      },
    });

    return NextResponse.json({
      success: true,
      request,
      availableUnusedSeats: available,
      idleSeatsCount: idleSeats.length,
      preCheck,
      intelligenceRecommendation: preCheck.message,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error submitting software request:', error);
    return NextResponse.json({ success: false, error: 'Failed to submit request' }, { status: 500 });
  }
}
