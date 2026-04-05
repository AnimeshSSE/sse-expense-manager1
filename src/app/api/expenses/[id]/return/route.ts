import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog, formatAuditValues } from '@/lib/audit';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Any approver can return
    const canReturn =
      checkPermission(session.role, 'ACCOUNTANT_APPROVE_EXPENSE') ||
      checkPermission(session.role, 'ADMIN_APPROVE_EXPENSE');

    if (!canReturn) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { reason } = body;

    if (!reason) {
      return NextResponse.json(
        { error: 'Return reason is required' },
        { status: 400 }
      );
    }

    const expense = await db.expense.findUnique({ where: { id } });
    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    if (expense.status === 'REJECTED' || expense.status === 'PAID') {
      return NextResponse.json(
        { error: 'Cannot return an already rejected or paid expense' },
        { status: 400 }
      );
    }

    const oldValues = formatAuditValues({ status: expense.status });

    const updatedExpense = await db.expense.update({
      where: { id },
      data: {
        status: 'RETURNED',
        returnReason: reason,
      },
      include: {
        site: {
          include: { client: { select: { id: true, name: true } } },
        },
        category: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const newValues = formatAuditValues({
      status: updatedExpense.status,
      returnReason: reason,
    });

    await createAuditLog({
      userId: session.id,
      action: 'RETURN_EXPENSE',
      entityType: 'EXPENSE',
      entityId: id,
      oldValues,
      newValues,
    });

    return NextResponse.json({ expense: updatedExpense });
  } catch (error: any) {
    console.error('Return expense error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
