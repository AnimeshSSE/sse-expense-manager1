import { db } from './db';
import { AuthUser } from './auth';

interface AuditLogParams {
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
}

export async function createAuditLog(params: AuditLogParams) {
  return db.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      oldValues: params.oldValues ? JSON.stringify(params.oldValues) : null,
      newValues: params.newValues ? JSON.stringify(params.newValues) : null,
      ipAddress: params.ipAddress,
    },
  });
}

export function formatAuditValues(values: any): any {
  if (!values) return null;
  // Sanitize sensitive fields
  const sanitized = { ...values };
  if ('password' in sanitized) delete sanitized.password;
  if ('token' in sanitized) delete sanitized.token;
  if ('tokenExpiry' in sanitized) delete sanitized.tokenExpiry;
  return sanitized;
}
