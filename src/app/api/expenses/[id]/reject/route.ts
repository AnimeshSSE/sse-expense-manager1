import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'
import { ExpenseStatus } from '@prisma/client'

// POST /api/expenses/[id]/reject
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Anyone with VIEW_ALL_EXPENSES can reject
    if (!checkPermission(session.role, 'VIEW_ALL_EXPENSES')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { reason } = body

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 })
    }

    const expense = await db.expense.findUnique({ where: { id } })
    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    // Can reject PENDING, ACCOUNTANT_APPROVED, ADMIN_APPROVED, RETURNED
    const rejectableStatuses: string[] = [ExpenseStatus.PENDING, ExpenseStatus.ACCOUNTANT_APPROVED, ExpenseStatus.ADMIN_APPROVED, ExpenseStatus.RETURNED]
    if (!rejectableStatuses.includes(expense.status as string)) {
      return NextResponse.json({ error: `Cannot reject expense with status: ${expense.status}` }, { status: 400 })
    }

    const oldValues = JSON.stringify(expense)
    const updated = await db.expense.update({
      where: { id },
      data: {
        status: ExpenseStatus.REJECTED,
        rejectionReason: reason.trim(),
      },
      include: {
        site: { include: { client: true } },
        category: true,
        user: { select: { id: true, name: true, email: true } },
        accountantApprovedBy: { select: { id: true, name: true } },
        adminApprovedBy: { select: { id: true, name: true } },
      },
    })

    await createAuditLog({
      userId: session.id,
      action: 'REJECT_EXPENSE',
      entityType: 'EXPENSE',
      entityId: id,
      oldValues,
      newValues: JSON.stringify(updated),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('POST /api/expenses/[id]/reject error:', error)
    return NextResponse.json({ error: 'Failed to reject expense' }, { status: 500 })
  }
}
