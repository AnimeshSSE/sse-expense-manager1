import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'
import { ExpenseStatus, PaymentMethod } from '@prisma/client'

// GET /api/expenses/[id] — single expense with full relations
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const expense = await db.expense.findUnique({
      where: { id },
      include: {
        site: { include: { client: true } },
        category: true,
        user: { select: { id: true, name: true, email: true, role: true } },
        accountantApprovedBy: { select: { id: true, name: true } },
        adminApprovedBy: { select: { id: true, name: true } },
      },
    })

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    // Ownership check
    if (!checkPermission(session.role, 'VIEW_ALL_EXPENSES') && expense.userId !== session.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ data: expense })
  } catch (error) {
    console.error('GET /api/expenses/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch expense' }, { status: 500 })
  }
}

// PUT /api/expenses/[id] — update expense
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const existing = await db.expense.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    // Only PENDING, RETURNED, or REJECTED can be edited
    const editableStatuses: string[] = [ExpenseStatus.PENDING, ExpenseStatus.RETURNED, ExpenseStatus.REJECTED]
    if (!editableStatuses.includes(existing.status as string)) {
      return NextResponse.json({ error: `Cannot edit expense with status: ${existing.status}` }, { status: 400 })
    }

    // Ownership check
    const isOwner = existing.userId === session.id
    const canEditAll = checkPermission(session.role, 'VIEW_ALL_EXPENSES')
    if (!isOwner && !canEditAll) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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

    // If expenseDate is changing, recalculate late submission
    let isLateSubmission = existing.isLateSubmission
    let daysLate = existing.daysLate
    if (expenseDate) {
      const expenseDateObj = new Date(expenseDate)
      const now = new Date()
      const diffMs = now.getTime() - expenseDateObj.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      isLateSubmission = diffDays > 7
      daysLate = isLateSubmission ? diffDays : 0
    }

    const oldValues = JSON.stringify(existing)

    const updateData: Record<string, unknown> = {}
    if (siteId !== undefined) updateData.siteId = siteId
    if (categoryId !== undefined) updateData.categoryId = categoryId
    if (amount !== undefined) updateData.amount = amount
    if (description !== undefined) updateData.description = description
    if (expenseDate !== undefined) updateData.expenseDate = new Date(expenseDate)
    if (sellerName !== undefined) updateData.sellerName = sellerName || null
    if (invoiceNumber !== undefined) updateData.invoiceNumber = invoiceNumber || null
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod as PaymentMethod
    if (notes !== undefined) updateData.notes = notes || null
    if (expenseDate !== undefined) {
      updateData.isLateSubmission = isLateSubmission
      updateData.daysLate = daysLate
    }
    // If status is RETURNED and we're editing, we might want to reset reasons
    if (existing.status === ExpenseStatus.RETURNED) {
      updateData.returnReason = null
    }

    const expense = await db.expense.update({
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
      action: 'UPDATE_EXPENSE',
      entityType: 'EXPENSE',
      entityId: id,
      oldValues,
      newValues: JSON.stringify(expense),
    })

    return NextResponse.json({ data: expense })
  } catch (error) {
    console.error('PUT /api/expenses/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 })
  }
}

// DELETE /api/expenses/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const existing = await db.expense.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
    }

    // Only PENDING or REJECTED can be deleted
    if (existing.status !== ExpenseStatus.PENDING && existing.status !== ExpenseStatus.REJECTED) {
      return NextResponse.json({ error: `Cannot delete expense with status: ${existing.status}` }, { status: 400 })
    }

    // Ownership check
    const isOwner = existing.userId === session.id
    const canEditAll = checkPermission(session.role, 'VIEW_ALL_EXPENSES')
    if (!isOwner && !canEditAll) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete comments first
    await db.comment.deleteMany({ where: { entityType: 'EXPENSE', entityId: id } })
    await db.expense.delete({ where: { id } })

    await createAuditLog({
      userId: session.id,
      action: 'DELETE_EXPENSE',
      entityType: 'EXPENSE',
      entityId: id,
      oldValues: JSON.stringify(existing),
    })

    return NextResponse.json({ message: 'Expense deleted successfully' })
  } catch (error) {
    console.error('DELETE /api/expenses/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 })
  }
}
