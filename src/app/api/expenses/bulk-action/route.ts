import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'
import { ExpenseStatus } from '@prisma/client'

type BulkAction = 'approve-accountant' | 'approve-admin' | 'reject' | 'return' | 'mark-paid'

// POST /api/expenses/bulk-action
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { ids, action, reason } = body as { ids?: string[]; action?: string; reason?: string }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 })
    }

    if (ids.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 items per bulk action' }, { status: 400 })
    }

    const validActions: BulkAction[] = ['approve-accountant', 'approve-admin', 'reject', 'return', 'mark-paid']
    if (!validActions.includes(action as BulkAction)) {
      return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 })
    }

    const bulkAction = action as BulkAction

    // Permission checks per action
    if (bulkAction === 'approve-accountant' && !checkPermission(session.role, 'ACCOUNTANT_APPROVE_EXPENSE')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (bulkAction === 'approve-admin' && !checkPermission(session.role, 'ADMIN_APPROVE_EXPENSE')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (bulkAction === 'mark-paid' && !checkPermission(session.role, 'MARK_PAID')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if ((bulkAction === 'reject' || bulkAction === 'return') && !checkPermission(session.role, 'VIEW_ALL_EXPENSES')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if ((bulkAction === 'reject' || bulkAction === 'return') && (!reason || reason.trim().length === 0)) {
      return NextResponse.json({ error: 'Reason is required for reject/return actions' }, { status: 400 })
    }

    // Fetch expenses
    const expenses = await db.expense.findMany({
      where: { id: { in: ids } },
    })

    const results: { success: string[]; failed: { id: string; reason: string }[] } = {
      success: [],
      failed: [],
    }

    for (const expense of expenses) {
      try {
        const auditAction = `BULK_${bulkAction.toUpperCase().replace('-', '_')}_EXPENSE`

        switch (bulkAction) {
          case 'approve-accountant': {
            if (expense.status !== ExpenseStatus.PENDING) {
              results.failed.push({ id: expense.id, reason: `Status is ${expense.status}, expected PENDING` })
              continue
            }
            await db.expense.update({
              where: { id: expense.id },
              data: {
                status: ExpenseStatus.ACCOUNTANT_APPROVED,
                accountantApprovedById: session.id,
                accountantApprovedAt: new Date(),
              },
            })
            break
          }
          case 'approve-admin': {
            if (expense.status !== ExpenseStatus.ACCOUNTANT_APPROVED) {
              results.failed.push({ id: expense.id, reason: `Status is ${expense.status}, expected ACCOUNTANT_APPROVED` })
              continue
            }
            await db.expense.update({
              where: { id: expense.id },
              data: {
                status: ExpenseStatus.ADMIN_APPROVED,
                adminApprovedById: session.id,
                adminApprovedAt: new Date(),
              },
            })
            break
          }
          case 'reject': {
            const rejectable: string[] = [ExpenseStatus.PENDING, ExpenseStatus.ACCOUNTANT_APPROVED, ExpenseStatus.ADMIN_APPROVED, ExpenseStatus.RETURNED]
            if (!rejectable.includes(expense.status as string)) {
              results.failed.push({ id: expense.id, reason: `Cannot reject status: ${expense.status}` })
              continue
            }
            await db.expense.update({
              where: { id: expense.id },
              data: { status: ExpenseStatus.REJECTED, rejectionReason: reason!.trim() },
            })
            break
          }
          case 'return': {
            const returnable: string[] = [ExpenseStatus.PENDING, ExpenseStatus.ACCOUNTANT_APPROVED]
            if (!returnable.includes(expense.status as string)) {
              results.failed.push({ id: expense.id, reason: `Cannot return status: ${expense.status}` })
              continue
            }
            await db.expense.update({
              where: { id: expense.id },
              data: { status: ExpenseStatus.RETURNED, returnReason: reason!.trim() },
            })
            break
          }
          case 'mark-paid': {
            if (expense.status !== ExpenseStatus.ADMIN_APPROVED) {
              results.failed.push({ id: expense.id, reason: `Status is ${expense.status}, expected ADMIN_APPROVED` })
              continue
            }
            await db.expense.update({
              where: { id: expense.id },
              data: { status: ExpenseStatus.PAID },
            })
            break
          }
        }

        await createAuditLog({
          userId: session.id,
          action: auditAction,
          entityType: 'EXPENSE',
          entityId: expense.id,
        })

        results.success.push(expense.id)
      } catch (e) {
        results.failed.push({ id: expense.id, reason: 'Unknown error' })
      }
    }

    return NextResponse.json({
      data: results,
      message: `${results.success.length} expenses processed, ${results.failed.length} failed`,
    })
  } catch (error) {
    console.error('POST /api/expenses/bulk-action error:', error)
    return NextResponse.json({ error: 'Failed to perform bulk action' }, { status: 500 })
  }
}
