import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'
import { ExpenseStatus } from '@prisma/client'

// POST /api/expenses/[id]/approve-admin
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!checkPermission(session.role, 'ADMIN_APPROVE_EXPENSE')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const expense = await db.expense.findUnique({ where: { id } })
    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    if (expense.status !== ExpenseStatus.ACCOUNTANT_APPROVED) {
      return NextResponse.json({ error: `Cannot approve: expense status is ${expense.status}, expected ACCOUNTANT_APPROVED` }, { status: 400 })
    }

    const oldValues = JSON.stringify(expense)
    const updated = await db.expense.update({
      where: { id },
      data: {
        status: ExpenseStatus.ADMIN_APPROVED,
        adminApprovedById: session.id,
        adminApprovedAt: new Date(),
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
      action: 'ADMIN_APPROVE_EXPENSE',
      entityType: 'EXPENSE',
      entityId: id,
      oldValues,
      newValues: JSON.stringify(updated),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('POST /api/expenses/[id]/approve-admin error:', error)
    return NextResponse.json({ error: 'Failed to approve expense' }, { status: 500 })
  }
}
