import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { Role, AuditAction } from '@prisma/client';

export async function GET(req: NextRequest) {
  const { user, errorResponse } = requireAuth(req, [Role.ADMIN, Role.MANAGER]);
  if (errorResponse || !user) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const action = searchParams.get('action');
    const entity = searchParams.get('entity');
    const search = searchParams.get('search')?.trim();

    const where: any = {};

    if (action && action !== 'ALL' && Object.values(AuditAction).includes(action as AuditAction)) {
      where.action = action as AuditAction;
    }

    if (entity && entity !== 'ALL') {
      where.entity = entity;
    }

    if (search) {
      const searchUpper = search.toUpperCase();
      const isEnum = Object.values(AuditAction).includes(searchUpper as AuditAction);

      where.OR = [
        { entity: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];

      if (isEnum) {
        where.OR.push({ action: searchUpper as AuditAction });
      }
    }

    const [total, logs, actionCountsGroup] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.groupBy({
        by: ['action'],
        _count: { action: true },
      }),
    ]);

    const actionCounts: Record<string, number> = {};
    for (const g of actionCountsGroup) {
      actionCounts[g.action] = g._count.action;
    }

    return NextResponse.json({
      success: true,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      logs,
      actionCounts,
    });
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ success: false, error: 'Failed to retrieve audit logs' }, { status: 500 });
  }
}
