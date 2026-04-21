import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'
import { ExpenseStatus, PaymentMethod } from '@/lib/prisma-constants'

// POST /api/expenses/[id]/resubmit — RETURNED -> PENDING
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const expense = await db.expense.findUnique({ where: { id } })
    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    if (expense.status !== ExpenseStatus.RETURNED) {
      return NextResponse.json({ error: `Cannot resubmit: expense status is ${expense.status}, expected RETURNED` }, { status: 400 })
    }

    // Only the owner can resubmit
    if (expense.userId !== session.id) {
      return NextResponse.json({ error: 'Only the expense creator can resubmit' }, { status: 403 })
    }

    const body = await req.json()
    const {
      siteId, categoryId, amount, description, expenseDate,
      sellerName, invoiceNumber, paymentMethod, notes,
    } = body

    // Validate if provided
    if (siteId) {
      const site = await db.site.findUnique({ where: { id: siteId } })
      if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    }
    if (categoryId) {
      const cat = await db.category.findUnique({ where: { id: categoryId } })
      if (!cat) return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }
    if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
    }

    // Recalculate late submission if expenseDate changed
    let isLateSubmission = expense.isLateSubmission
    let daysLate = expense.daysLate
    if (expenseDate) {
      const expenseDateObj = new Date(expenseDate)
      const now = new Date()
      const diffMs = now.getTime() - expenseDateObj.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      isLateSubmission = diffDays > 7
      daysLate = isLateSubmission ? diffDays : 0
    }

    const oldValues = JSON.stringify(expense)

    const updateData: Record<string, unknown> = {
      status: ExpenseStatus.PENDING,
      returnReason: null,
    }
    if (siteId !== undefined) updateData.siteId = siteId
    if (categoryId !== undefined) updateData.categoryId = categoryId
    if (amount !== undefined) updateData.amount = amount
    if (description !== undefined) updateData.description = description
    if (expenseDate !== undefined) {
      updateData.expenseDate = new Date(expenseDate)
      updateData.isLateSubmission = isLateSubmission
      updateData.daysLate = daysLate
    }
    if (sellerName !== undefined) updateData.sellerName = sellerName || null
    if (invoiceNumber !== undefined) updateData.invoiceNumber = invoiceNumber || null
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod as PaymentMethod
    if (notes !== undefined) updateData.notes = notes || null

    const updated = await db.expense.update({
      where: { id },
      data: updateData,
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
      action: 'RESUBMIT_EXPENSE',
      entityType: 'EXPENSE',
      entityId: id,
      oldValues,
      newValues: JSON.stringify(updated),
    })

    return NextResponse.json({ data: updated })
  } catch (error) {
    console.error('POST /api/expenses/[id]/resubmit error:', error)
    return NextResponse.json({ error: 'Failed to resubmit expense' }, { status: 500 })
  }
}
