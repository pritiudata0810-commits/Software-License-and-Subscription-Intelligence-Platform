import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import {
  AuditAction,
  Role,
  RequestStatus,
  ApprovalDecision,
  ApprovalAction,
  AssignmentStatus,
} from '@prisma/client';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, errorResponse } = requireAuth(req, [Role.ADMIN, Role.MANAGER]);
  if (errorResponse || !user) return errorResponse;

  try {
    const body = await req.json();
    const { decision, action, targetAssignmentId, comments } = body; // decision: 'APPROVED' | 'REJECTED'

    if (!decision || !['APPROVED', 'REJECTED'].includes(decision)) {
      return NextResponse.json(
        { success: false, error: "Decision must be either 'APPROVED' or 'REJECTED'" },
        { status: 400 }
      );
    }

    const request = await prisma.softwareRequest.findUnique({
      where: { id: params.id },
      include: {
        user: { select: { id: true, name: true, email: true, departmentId: true } },
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
      },
    });

    if (!request) {
      return NextResponse.json({ success: false, error: 'Software request not found' }, { status: 404 });
    }

    if (request.status !== RequestStatus.PENDING) {
      return NextResponse.json(
        { success: false, error: `Request is already ${request.status}` },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        let finalStatus: RequestStatus = RequestStatus.REJECTED;
      let finalAction: ApprovalAction = ApprovalAction.REJECTED_NO_BUDGET;
      let assignedLicenseId: string | null = null;
      let reclaimedUser: { id: string; name: string; email: string; daysInactive?: number } | null = null;

      if (decision === 'APPROVED') {
        if (action === 'RECLAIM_AND_ASSIGN') {
          // Phase 3: Reclaim dormant seat (>60d inactive) and assign to requester
          let targetAssignment: any = null;

          if (targetAssignmentId) {
            targetAssignment = await tx.licenseAssignment.findUnique({
              where: { id: targetAssignmentId },
              include: {
                user: { select: { id: true, name: true, email: true } },
                license: true,
                department: true,
              },
            });
          }

          if (
            !targetAssignment ||
            targetAssignment.status !== AssignmentStatus.ACTIVE ||
            targetAssignment.license.softwareId !== request.softwareId
          ) {
            // Locate best candidate (>60d idle) among active assignments
            const activeAssignments = await tx.licenseAssignment.findMany({
              where: {
                license: { softwareId: request.softwareId },
                status: AssignmentStatus.ACTIVE,
                userId: { not: request.userId },
              },
              include: {
                user: { select: { id: true, name: true, email: true } },
                license: true,
                department: true,
              },
            });

            if (activeAssignments.length > 0) {
              const userIds = activeAssignments.map((a) => a.userId);
              const usages = await tx.usageRecord.findMany({
                where: {
                  softwareId: request.softwareId,
                  userId: { in: userIds },
                },
                orderBy: { lastActiveDate: 'desc' },
              });

              const usageMap = new Map<string, typeof usages[0]>();
              for (const u of usages) {
                if (!usageMap.has(u.userId)) {
                  usageMap.set(u.userId, u);
                }
              }

              const now = new Date();
              let bestCandidate: typeof activeAssignments[0] | null = null;
              let maxDaysInactive = 60; // strictly > 60 days

              for (const a of activeAssignments) {
                const u = usageMap.get(a.userId);
                let daysInactive = 999;
                if (u && u.lastActiveDate) {
                  daysInactive = Math.floor(
                    (now.getTime() - new Date(u.lastActiveDate).getTime()) / (1000 * 60 * 60 * 24)
                  );
                } else if (a.assignedDate) {
                  daysInactive = Math.floor(
                    (now.getTime() - new Date(a.assignedDate).getTime()) / (1000 * 60 * 60 * 24)
                  );
                }

                if (daysInactive > maxDaysInactive) {
                  maxDaysInactive = daysInactive;
                  bestCandidate = a;
                }
              }

              targetAssignment = bestCandidate;
            }
          }

          if (!targetAssignment) {
            throw new Error('No reclaimable dormant seat (>60d idle) found for this software.');
          }

          // 1. Revoke dormant seat
          await tx.licenseAssignment.update({
            where: { id: targetAssignment.id },
            data: {
              status: AssignmentStatus.REVOKED,
              notes: `Reclaimed dormant seat (>60d idle) to fulfill software request #${request.id} for ${request.user.name}`,
            },
          });

          // 2. Record REVOKE_LICENSE in auditLog
          await tx.auditLog.create({
            data: {
              userId: user.userId,
              action: AuditAction.REVOKE_LICENSE,
              entity: 'LicenseAssignment',
              entityId: targetAssignment.id,
              details: {
                revokedFromUserId: targetAssignment.userId,
                revokedFromUserName: targetAssignment.user.name,
                revokedFromUserEmail: targetAssignment.user.email,
                softwareId: request.softwareId,
                softwareName: request.software.name,
                licenseId: targetAssignment.licenseId,
                reason: 'Reclaimed dormant seat (>60d idle) for reallocation to pending requester',
                requestId: request.id,
                reallocatedToUserId: request.userId,
                reallocatedToUserName: request.user.name,
              },
              ipAddress: '127.0.0.1',
            },
          });

          // 3. Clean up any existing revoked assignments for requester on this license to prevent unique constraint conflict
          await tx.licenseAssignment.deleteMany({
            where: {
              licenseId: targetAssignment.licenseId,
              userId: request.userId,
            },
          });

          // 4. Create active assignment for requester
          const newAssignment = await tx.licenseAssignment.create({
            data: {
              licenseId: targetAssignment.licenseId,
              userId: request.userId,
              departmentId: request.user.departmentId,
              status: AssignmentStatus.ACTIVE,
              notes: `Reallocated from dormant seat (${targetAssignment.user.name}) for request #${request.id}`,
            },
          });

          // 5. Record ASSIGN_LICENSE in auditLog
          await tx.auditLog.create({
            data: {
              userId: user.userId,
              action: AuditAction.ASSIGN_LICENSE,
              entity: 'LicenseAssignment',
              entityId: newAssignment.id,
              details: {
                assignedToUserId: request.userId,
                assignedToUserName: request.user.name,
                assignedToUserEmail: request.user.email,
                softwareId: request.softwareId,
                softwareName: request.software.name,
                licenseId: targetAssignment.licenseId,
                reallocatedFromUserId: targetAssignment.userId,
                reallocatedFromUserName: targetAssignment.user.name,
                reason: `Reallocated reclaimed idle seat to fulfill software request #${request.id}`,
                requestId: request.id,
              },
              ipAddress: '127.0.0.1',
            },
          });

          // 6. Update or create requester's UsageRecord
          const existingUsage = await tx.usageRecord.findFirst({
            where: {
              userId: request.userId,
              softwareId: request.softwareId,
            },
          });

          if (existingUsage) {
            await tx.usageRecord.update({
              where: { id: existingUsage.id },
              data: {
                licenseId: targetAssignment.licenseId,
                lastActiveDate: new Date(),
                loginCount: { increment: 1 },
                hoursUsed: { increment: 1.0 },
                utilizationStatus: 'MODERATE',
              },
            });
          } else {
            await tx.usageRecord.create({
              data: {
                userId: request.userId,
                softwareId: request.softwareId,
                licenseId: targetAssignment.licenseId,
                lastActiveDate: new Date(),
                loginCount: 1,
                hoursUsed: 1.0,
                utilizationStatus: 'MODERATE',
              },
            });
          }

          // 7. Update any matching open Recommendation for this dormant seat to COMPLETED
          await tx.recommendation.updateMany({
            where: {
              softwareId: request.softwareId,
              status: { in: ['NEW', 'REVIEWED'] },
              title: { contains: targetAssignment.user.name },
            },
            data: { status: 'COMPLETED' },
          });

          finalStatus = RequestStatus.FULFILLED_EXISTING;
          finalAction = ApprovalAction.ASSIGNED_EXISTING;
          assignedLicenseId = targetAssignment.licenseId;
          reclaimedUser = {
            id: targetAssignment.user.id,
            name: targetAssignment.user.name,
            email: targetAssignment.user.email,
          };
        } else if (action === 'PURCHASE_NEW') {
          // Explicitly authorized new procurement
          finalStatus = RequestStatus.APPROVED;
          finalAction = ApprovalAction.PURCHASE_AUTHORIZED;
        } else {
          // Standard check: check for available unassigned license in the pool
          let selectedLicense = null;
          for (const lic of request.software.licenses) {
            const activeCount = lic.assignments.length;
            if (lic.totalQuantity - activeCount > 0) {
              selectedLicense = lic;
              break;
            }
          }

          if (selectedLicense) {
            // Re-use existing unassigned license!
            finalStatus = RequestStatus.FULFILLED_EXISTING;
            finalAction = ApprovalAction.ASSIGNED_EXISTING;
            assignedLicenseId = selectedLicense.id;

            // Delete existing revoked assignment for requester on this license to prevent unique constraint conflict
            await tx.licenseAssignment.deleteMany({
              where: {
                licenseId: selectedLicense.id,
                userId: request.userId,
              },
            });

            const newAssignment = await tx.licenseAssignment.create({
              data: {
                licenseId: selectedLicense.id,
                userId: request.userId,
                departmentId: request.user.departmentId,
                status: AssignmentStatus.ACTIVE,
                notes: `Fulfillment of software request #${request.id} from unassigned pool`,
              },
            });

            await tx.auditLog.create({
              data: {
                userId: user.userId,
                action: AuditAction.ASSIGN_LICENSE,
                entity: 'LicenseAssignment',
                entityId: newAssignment.id,
                details: {
                  assignedToUserId: request.userId,
                  assignedToUserName: request.user.name,
                  assignedToUserEmail: request.user.email,
                  softwareId: request.softwareId,
                  softwareName: request.software.name,
                  licenseId: selectedLicense.id,
                  reason: `Allocated unassigned license to fulfill software request #${request.id}`,
                  requestId: request.id,
                },
                ipAddress: '127.0.0.1',
              },
            });

            // Update or create requester's usage record
            const existingUsage = await tx.usageRecord.findFirst({
              where: {
                userId: request.userId,
                softwareId: request.softwareId,
              },
            });

            if (existingUsage) {
              await tx.usageRecord.update({
                where: { id: existingUsage.id },
                data: {
                  licenseId: selectedLicense.id,
                  lastActiveDate: new Date(),
                  loginCount: { increment: 1 },
                  hoursUsed: { increment: 1.0 },
                  utilizationStatus: 'MODERATE',
                },
              });
            } else {
              await tx.usageRecord.create({
                data: {
                  userId: request.userId,
                  softwareId: request.softwareId,
                  licenseId: selectedLicense.id,
                  lastActiveDate: new Date(),
                  loginCount: 1,
                  hoursUsed: 1.0,
                  utilizationStatus: 'MODERATE',
                },
              });
            }
          } else {
            // No unassigned license in pool -> Approve for procurement
            finalStatus = RequestStatus.APPROVED;
            finalAction = ApprovalAction.PURCHASE_AUTHORIZED;
          }
        }
      }

      // Update request status
      const updatedReq = await tx.softwareRequest.update({
        where: { id: params.id },
        data: { status: finalStatus },
      });

      // Create Approval record
      const defaultComment =
        action === 'RECLAIM_AND_ASSIGN' && reclaimedUser
          ? `Approved by reclaiming dormant seat (>60d idle from ${reclaimedUser.name}) and reassigning to ${request.user.name}. ₹0 new procurement cost.`
          : finalAction === ApprovalAction.ASSIGNED_EXISTING
          ? `Approved by allocating existing unassigned license from software pool.`
          : finalAction === ApprovalAction.PURCHASE_AUTHORIZED
          ? `Approved for procurement of new license seat.`
          : 'Rejected by manager.';

      const approval = await tx.requestApproval.create({
        data: {
          requestId: params.id,
          approvedById: user.userId,
          decision: decision === 'APPROVED' ? ApprovalDecision.APPROVED : ApprovalDecision.REJECTED,
          actionTaken: finalAction,
          comments: comments || defaultComment,
        },
      });

      // Record APPROVE_REQUEST or REJECT_REQUEST in auditLog
      await tx.auditLog.create({
        data: {
          userId: user.userId,
          action: decision === 'APPROVED' ? AuditAction.APPROVE_REQUEST : AuditAction.REJECT_REQUEST,
          entity: 'SoftwareRequest',
          entityId: params.id,
          details: {
            decision,
            actionTaken: finalAction,
            actionType: action || 'STANDARD',
            softwareName: request.software.name,
            requestedBy: request.user.name,
            reclaimedFrom: reclaimedUser ? reclaimedUser.name : null,
          },
          ipAddress: '127.0.0.1',
        },
      });

      return { updatedReq, approval, finalAction, assignedLicenseId, reclaimedUser };
    }, { maxWait: 10000, timeout: 20000 });

    let message = `Request ${decision.toLowerCase()} successfully.`;
    if (decision === 'APPROVED') {
      if (result.reclaimedUser) {
        message = `Request approved! Reclaimed dormant seat from ${result.reclaimedUser.name} and reallocated to ${request.user.name}. (₹0 new procurement cost).`;
      } else if (result.finalAction === ApprovalAction.ASSIGNED_EXISTING) {
        message = `Request approved! Allocated an existing unused license for ${request.software.name} immediately to ${request.user.name}.`;
      } else {
        message = `Request approved for procurement of new license seat.`;
      }
    }

    return NextResponse.json({
      success: true,
      message,
      actionTaken: result.finalAction,
      reclaimedUser: result.reclaimedUser || null,
      request: result.updatedReq,
      approval: result.approval,
    });
  } catch (error: any) {
    console.error('Error processing approval:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process request approval' },
      { status: 500 }
    );
  }
}
