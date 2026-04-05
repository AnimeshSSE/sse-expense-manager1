import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog, formatAuditValues } from '@/lib/audit';
import { ExpenseStatus } from '@prisma/client';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;

    const expense = await db.expense.findUnique({
      where: { id },
      include: {
        site: {
          include: { client: { select: { id: true, name: true } } },
        },
        category: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
        accountantApprovedBy: { select: { id: true, name: true } },
        adminApprovedBy: { select: { id: true, name: true } },
      },
    });

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    // Check access: user can only view own unless has VIEW_ALL_EXPENSES
    if (
      !checkPermission(session.role, 'VIEW_ALL_EXPENSES') &&
      expense.userId !== session.id
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ expense });
  } catch (error: any) {
    console.error('Get expense error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;

    const existingExpense = await db.expense.findUnique({ where: { id } });
    if (!existingExpense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    // Only own expense and only PENDING or RETURNED
    if (existingExpense.userId !== session.id) {
      return NextResponse.json({ error: 'You can only edit your own expenses' }, { status: 403 });
    }

    if (
      existingExpense.status !== 'PENDING' &&
      existingExpense.status !== 'RETURNED'
    ) {
      return NextResponse.json(
        { error: 'Can only edit PENDING or RETURNED expenses' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      siteId, categoryId, amount, description, expenseDate,
      sellerName, invoiceNumber, paymentMethod,
      receiptUrl, receiptFileName, notes,
    } = body;

    const oldValues = formatAuditValues({
      siteId: existingExpense.siteId,
      categoryId: existingExpense.categoryId,
      amount: existingExpense.amount,
      description: existingExpense.description,
      expenseDate: existingExpense.expenseDate,
      sellerName: existingExpense.sellerName,
      invoiceNumber: existingExpense.invoiceNumber,
      paymentMethod: existingExpense.paymentMethod,
      notes: existingExpense.notes,
    });

    // If status was RETURNED, set back to PENDING on edit
    const updateData: any = {
      ...(siteId !== undefined && { siteId }),
      ...(categoryId !== undefined && { categoryId }),
      ...(amount !== undefined && { amount: parseFloat(amount) }),
      ...(description !== undefined && { description }),
      ...(expenseDate !== undefined && { expenseDate: new Date(expenseDate) }),
      ...(sellerName !== undefined && { sellerName: sellerName || null }),
      ...(invoiceNumber !== undefined && { invoiceNumber: invoiceNumber || null }),
      ...(paymentMethod !== undefined && { paymentMethod }),
      ...(receiptUrl !== undefined && { receiptUrl: receiptUrl || null }),
      ...(receiptFileName !== undefined && { receiptFileName: receiptFileName || null }),
      ...(notes !== undefined && { notes: notes || null }),
    };

    if (existingExpense.status === 'RETURNED') {
      updateData.status = 'PENDING';
      updateData.returnReason = null;
    }

    const expense = await db.expense.update({
      where: { id },
      data: updateData,
      include: {
        site: {
          include: { client: { select: { id: true, name: true } } },
        },
        category: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const newValues = formatAuditValues(updateData);

    await createAuditLog({
      userId: session.id,
      action: 'UPDATE_EXPENSE',
      entityType: 'EXPENSE',
      entityId: id,
      oldValues,
      newValues,
    });

    return NextResponse.json({ expense });
  } catch (error: any) {
    console.error('Update expense error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;

    const expense = await db.expense.findUnique({ where: { id } });
    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    if (expense.userId !== session.id) {
      return NextResponse.json({ error: 'You can only delete your own expenses' }, { status: 403 });
    }

    if (expense.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Can only delete PENDING expenses' },
        { status: 400 }
      );
    }

    const oldValues = formatAuditValues({
      id: expense.id,
      amount: expense.amount,
      description: expense.description,
      status: expense.status,
    });

    await db.expense.delete({ where: { id } });

    await createAuditLog({
      userId: session.id,
      action: 'DELETE_EXPENSE',
      entityType: 'EXPENSE',
      entityId: id,
      oldValues,
    });

    return NextResponse.json({ message: 'Expense deleted successfully' });
  } catch (error: any) {
    console.error('Delete expense error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
