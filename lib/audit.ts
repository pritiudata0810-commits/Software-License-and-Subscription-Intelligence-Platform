import prisma from './prisma';
import { AuditAction, Prisma } from '@prisma/client';

export interface AuditLogParams {
  userId?: string | null;
  actorId?: string | null;
  action: AuditAction;
  entity?: string;
  entityType?: string;
  entityId?: string | null;
  details?: Record<string, any>;
  ipAddress?: string;
}

export async function recordAuditLog(
  params: AuditLogParams,
  tx?: Prisma.TransactionClient | typeof prisma
) {
  try {
    const client = tx || prisma;
    const actorId = params.actorId || params.userId || null;
    const entityType = params.entity || params.entityType || 'General';

    return await client.auditLog.create({
      data: {
        userId: actorId,
        action: params.action,
        entity: entityType,
        entityId: params.entityId || null,
        details: params.details || {},
        ipAddress: params.ipAddress || '127.0.0.1',
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
    return null;
  }
}
