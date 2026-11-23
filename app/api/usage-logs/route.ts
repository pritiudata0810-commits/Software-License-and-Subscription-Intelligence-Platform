import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';
import { AuditAction, Role, UtilizationStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { user, errorResponse } = requireAuth(req);
  if (errorResponse || !user) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const softwareId = searchParams.get('softwareId');
    const tier = searchParams.get('tier'); // OPTIMAL, UNDERUTILIZED, IDLE_60D
    const search = searchParams.get('search')?.toLowerCase();

    const where: any = {};

    // If Employee, scope strictly to their own usage logs
    if (user.role === Role.EMPLOYEE) {
      where.userId = user.userId;
    } else if (searchParams.get('userId')) {
      where.userId = searchParams.get('userId');
    }

    if (softwareId) {
      where.softwareId = softwareId;
    }

    // Fetch records with user, department, software, license
    const usageRecords = await prisma.usageRecord.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: { select: { id: true, name: true, code: true } },
          },
        },
        software: {
          select: {
            id: true,
            name: true,
            category: true,
            consumptionType: true,
          },
        },
        license: {
          select: {
            id: true,
            licenseType: true,
            costPerLicense: true,
            billingFrequency: true,
          },
        },
      },
      orderBy: { lastActiveDate: 'desc' },
    });

    const now = new Date();

    const enriched = usageRecords.map((r) => {
      const lastActive = r.lastActiveDate ? new Date(r.lastActiveDate) : new Date(r.recordedAt);
      const daysInactive = Math.max(
        0,
        Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24))
      );

      let classificationTier: 'OPTIMAL' | 'UNDERUTILIZED' | 'IDLE_60D';
      let classificationLabel: string;

      if (daysInactive > 60) {
        classificationTier = 'IDLE_60D';
        classificationLabel = 'Idle (>60d)';
      } else if (daysInactive > 30 || r.hoursUsed < 15 || r.utilizationStatus === 'LOW') {
        classificationTier = 'UNDERUTILIZED';
        classificationLabel = 'Underutilized';
      } else {
        classificationTier = 'OPTIMAL';
        classificationLabel = 'Optimal';
      }

      return {
        id: r.id,
        userId: r.userId,
        userName: r.user?.name || 'Unknown User',
        userEmail: r.user?.email || 'N/A',
        userRole: r.user?.role || 'EMPLOYEE',
        departmentName: r.user?.department?.name || 'General',
        softwareId: r.softwareId,
        softwareName: r.software?.name || 'N/A',
        softwareCategory: r.software?.category || 'General',
        licenseId: r.licenseId,
        licenseCostMonthly: r.license
          ? r.license.billingFrequency === 'ANNUAL'
            ? r.license.costPerLicense / 12
            : r.license.costPerLicense
          : 0,
        lastActiveDate: r.lastActiveDate.toISOString(),
        hoursUsed: r.hoursUsed,
        loginCount: r.loginCount,
        tokensAllocated: r.tokensAllocated || 0,
        tokensUsed: r.tokensUsed || 0,
        utilizationStatus: r.utilizationStatus,
        daysInactive,
        classificationTier,
        classificationLabel,
        recordedAt: r.recordedAt.toISOString(),
      };
    });

    // Apply tier and search filters if specified
    let filtered = enriched;
    if (tier) {
      filtered = filtered.filter((r) => r.classificationTier === tier);
    }
    if (search) {
      filtered = filtered.filter(
        (r) =>
          r.userName.toLowerCase().includes(search) ||
          r.userEmail.toLowerCase().includes(search) ||
          r.softwareName.toLowerCase().includes(search) ||
          r.departmentName.toLowerCase().includes(search)
      );
    }

    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      logs: paginated,
    });
  } catch (error: any) {
    console.error('Error fetching usage telemetry logs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve usage telemetry logs' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { user, errorResponse } = requireAuth(req, [Role.ADMIN, Role.MANAGER]);
  if (errorResponse || !user) return errorResponse;

  try {
    const body = await req.json();
    const {
      userId,
      userEmail,
      softwareId,
      softwareName,
      licenseId,
      hoursUsed = 1.0,
      loginCount = 1,
      lastActiveDate,
      actionNote,
    } = body;

    let targetUserId = userId;
    let targetSoftwareId = softwareId;
    let targetLicenseId = licenseId;

    // 1. Resolve user if userEmail provided
    if (!targetUserId && userEmail) {
      const foundUser = await prisma.user.findUnique({
        where: { email: String(userEmail).trim().toLowerCase() },
      });
      if (!foundUser) {
        return NextResponse.json(
          { success: false, error: `User with email "${userEmail}" not found.` },
          { status: 404 }
        );
      }
      targetUserId = foundUser.id;
    }

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: 'Either userId or userEmail is required.' },
        { status: 400 }
      );
    }

    // 2. Resolve software if softwareName provided
    if (!targetSoftwareId && softwareName) {
      const foundSoftware = await prisma.software.findFirst({
        where: { name: { contains: String(softwareName).trim() } },
      });
      if (!foundSoftware) {
        return NextResponse.json(
          { success: false, error: `Software "${softwareName}" not found.` },
          { status: 404 }
        );
      }
      targetSoftwareId = foundSoftware.id;
    }

    // 3. Resolve active license assignment
    let activeAssignment = null;
    if (targetLicenseId) {
      activeAssignment = await prisma.licenseAssignment.findFirst({
        where: {
          userId: targetUserId,
          licenseId: targetLicenseId,
          status: 'ACTIVE',
        },
        include: { license: { include: { software: true } }, user: true },
      });
    } else if (targetSoftwareId) {
      activeAssignment = await prisma.licenseAssignment.findFirst({
        where: {
          userId: targetUserId,
          license: { softwareId: targetSoftwareId },
          status: 'ACTIVE',
        },
        include: { license: { include: { software: true } }, user: true },
      });
    } else {
      // Find any active assignment for this user
      activeAssignment = await prisma.licenseAssignment.findFirst({
        where: { userId: targetUserId, status: 'ACTIVE' },
        include: { license: { include: { software: true } }, user: true },
      });
    }

    if (!activeAssignment) {
      return NextResponse.json(
        {
          success: false,
          error:
            'User does not hold an active license assignment for this software/license. Telemetry requires an active seat.',
        },
        { status: 400 }
      );
    }

    targetLicenseId = activeAssignment.licenseId;
    targetSoftwareId = activeAssignment.license.softwareId;

    const activityDate = lastActiveDate ? new Date(lastActiveDate) : new Date();
    const addedHours = Number(hoursUsed) || 1.0;
    const addedLogins = Number(loginCount) || 1;

    // 4. Find existing usage record or create new
    const existingRecord = await prisma.usageRecord.findFirst({
      where: {
        userId: targetUserId,
        softwareId: targetSoftwareId,
      },
    });

    let savedRecord;
    let isNew = false;

    if (existingRecord) {
      const newTotalHours = existingRecord.hoursUsed + addedHours;
      const newTotalLogins = existingRecord.loginCount + addedLogins;

      // Determine utilization status
      let utilStatus: UtilizationStatus = UtilizationStatus.MODERATE;
      if (newTotalHours >= 40) utilStatus = UtilizationStatus.HIGH;
      else if (newTotalHours < 15) utilStatus = UtilizationStatus.LOW;

      savedRecord = await prisma.usageRecord.update({
        where: { id: existingRecord.id },
        data: {
          licenseId: targetLicenseId,
          lastActiveDate: activityDate,
          hoursUsed: newTotalHours,
          loginCount: newTotalLogins,
          utilizationStatus: utilStatus,
        },
      });
    } else {
      isNew = true;
      let utilStatus: UtilizationStatus = UtilizationStatus.MODERATE;
      if (addedHours >= 40) utilStatus = UtilizationStatus.HIGH;
      else if (addedHours < 15) utilStatus = UtilizationStatus.LOW;

      savedRecord = await prisma.usageRecord.create({
        data: {
          userId: targetUserId,
          softwareId: targetSoftwareId,
          licenseId: targetLicenseId,
          lastActiveDate: activityDate,
          hoursUsed: addedHours,
          loginCount: addedLogins,
          utilizationStatus: utilStatus,
        },
      });
    }

    // 5. Write entry to audit_logs
    await recordAuditLog({
      actorId: user.userId,
      userId: user.userId,
      action: isNew ? AuditAction.CREATE : AuditAction.UPDATE,
      entityType: 'UsageRecord',
      entity: 'UsageRecord',
      entityId: savedRecord.id,
      details: {
        type: 'TELEMETRY_LOG',
        softwareName: activeAssignment.license.software.name,
        targetUserName: activeAssignment.user.name,
        targetUserEmail: activeAssignment.user.email,
        hoursLogged: addedHours,
        totalHours: savedRecord.hoursUsed,
        loginsLogged: addedLogins,
        totalLogins: savedRecord.loginCount,
        lastActiveDate: savedRecord.lastActiveDate.toISOString(),
        note: actionNote || 'User telemetry event ingested via API ledger',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Telemetry recorded successfully for ${activeAssignment.user.name} on ${activeAssignment.license.software.name}.`,
      record: savedRecord,
    });
  } catch (error: any) {
    console.error('Error logging telemetry:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to ingest telemetry' },
      { status: 500 }
    );
  }
}
