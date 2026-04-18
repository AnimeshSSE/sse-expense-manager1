import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admin can mark salary as paid' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.salary.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Salary not found' }, { status: 404 });
    }

    if (existing.status === 'PAID') {
      return NextResponse.json({ error: 'Salary is already marked as paid' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const paidDate = body.paidDate ? new Date(body.paidDate) : new Date();

    const salary = await db.salary.update({
      where: { id },
      data: {
        status: 'PAID',
        paidDate,
      },
      include: {
        employee: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    await createAuditLog({
      userId: session.id,
      action: 'MARK_SALARY_PAID',
      entityType: 'SALARY',
      entityId: id,
      newValues: { month: existing.month, netSalary: existing.netSalary, paidDate },
    });

    return NextResponse.json({ salary });
  } catch (error: any) {
    console.error('Mark salary paid error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
