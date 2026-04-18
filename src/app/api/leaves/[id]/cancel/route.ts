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

    const { id } = await params;
    const existing = await db.leave.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Leave not found' }, { status: 404 });
    }

    if (existing.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only pending leaves can be cancelled' }, { status: 400 });
    }

    // Only the owner can cancel their own leave
    const employee = await db.employee.findUnique({ where: { id: existing.employeeId } });
    if (!employee || (employee.userId !== session.id && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'You can only cancel your own leave' }, { status: 403 });
    }

    const leave = await db.leave.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
      include: {
        employee: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    await createAuditLog({
      userId: session.id,
      action: 'CANCEL_LEAVE',
      entityType: 'LEAVE',
      entityId: id,
      newValues: { employeeId: existing.employeeId },
    });

    return NextResponse.json({ leave });
  } catch (error: any) {
    console.error('Cancel leave error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
