import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'
import type { Prisma } from '@prisma/client'

// POST /api/requisitions/bulk-action
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!checkPermission(session.role, 'VIEW_ALL_MIRS')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { ids, action, reason } = await req.json()

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'IDs are required' }, { status: 400 })
    }

    if (!['approve_stock_manager', 'approve_admin', 'reject', 'return'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    if ((action === 'reject' || action === 'return') && !reason) {
      return NextResponse.json({ error: 'Reason is required for reject/return actions' }, { status: 400 })
    }

    const requisitions = await db.requisition.findMany({
      where: { id: { in: ids } },
    })

    const results: { id: string; success: boolean; error?: string }[] = []
    let processedCount = 0

    for (const reqItem of requisitions) {
      try {
        const updateData: any = {}

        switch (action) {
          case 'approve_stock_manager':
            if (reqItem.status !== 'PENDING') {
              results.push({ id: reqItem.id, success: false, error: `Not in PENDING status` })
              continue
            }
            updateData.status = 'STOCK_MANAGER_APPROVED'
            updateData.stockManagerApprovedById = session.id
            updateData.stockManagerApprovedAt = new Date()
            break

          case 'approve_admin':
            if (reqItem.status !== 'STOCK_MANAGER_APPROVED') {
              results.push({ id: reqItem.id, success: false, error: `Not in STOCK_MANAGER_APPROVED status` })
              continue
            }
            updateData.status = 'ADMIN_APPROVED'
            updateData.adminApprovedById = session.id
            updateData.adminApprovedAt = new Date()
            break

          case 'reject':
            if (!['PENDING', 'STOCK_MANAGER_APPROVED', 'ADMIN_APPROVED'].includes(reqItem.status)) {
              results.push({ id: reqItem.id, success: false, error: `Cannot reject in ${reqItem.status} status` })
              continue
            }
            updateData.status = 'REJECTED'
            updateData.rejectionReason = reason
            break

          case 'return':
            if (!['PENDING', 'STOCK_MANAGER_APPROVED', 'ADMIN_APPROVED'].includes(reqItem.status)) {
              results.push({ id: reqItem.id, success: false, error: `Cannot return in ${reqItem.status} status` })
              continue
            }
            updateData.status = 'RETURNED'
            updateData.returnReason = reason
            break
        }

        await db.requisition.update({
          where: { id: reqItem.id },
          data: updateData,
        })

        await createAuditLog({
          userId: session.id,
          action: `BULK_${action.toUpperCase()}_REQUISITION`,
          entityType: 'REQUISITION',
          entityId: reqItem.id,
          oldValues: JSON.stringify({ status: reqItem.status }),
          newValues: JSON.stringify({ status: updateData.status, reason: reason || undefined }),
        })

        results.push({ id: reqItem.id, success: true })
        processedCount++
      } catch (err: any) {
        results.push({ id: reqItem.id, success: false, error: err.message })
      }
    }

    return NextResponse.json({
      data: { processed: processedCount, total: ids.length, results },
    })
  } catch (error: any) {
    console.error('POST /api/requisitions/bulk-action error:', error)
    return NextResponse.json({ error: 'Failed to perform bulk action' }, { status: 500 })
  }
}
