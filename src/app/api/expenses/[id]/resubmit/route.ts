import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog, formatAuditValues } from '@/lib/audit';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!checkPermission(session.role, 'SUBMIT_EXPENSE')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    const expense = await db.expense.findUnique({ where: { id } });
    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    if (expense.userId !== session.id) {
      return NextResponse.json(
        { error: 'You can only resubmit your own expenses' },
        { status: 403 }
      );
    }

    if (expense.status !== 'RETURNED') {
      return NextResponse.json(
        { error: 'Expense must be in RETURNED status to resubmit' },
        { status: 400 }
      );
    }

    const oldValues = formatAuditValues({
      status: expense.status,
      returnReason: expense.returnReason,
    });

    const updatedExpense = await db.expense.update({
      where: { id },
      data: {
        status: 'PENDING',
        returnReason: null,
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
    });

    await createAuditLog({
      userId: session.id,
      action: 'RESUBMIT_EXPENSE',
      entityType: 'EXPENSE',
      entityId: id,
      oldValues,
      newValues,
    });

    return NextResponse.json({ expense: updatedExpense });
  } catch (error: any) {
    console.error('Resubmit expense error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
