import { db } from './db'
import { headers } from 'next/headers'

interface AuditParams {
  userId: string
  action: string
  entityType: string
  entityId?: string
  oldValues?: string
  newValues?: string
}

export async function createAuditLog(params: AuditParams): Promise<void> {
  try {
    const headersList = await headers()
    const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || null
    await db.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        oldValues: params.oldValues || null,
        newValues: params.newValues || null,
        ipAddress: ip,
      },
    })
  } catch (error) {
    console.error('Audit log error:', error)
  }
}
