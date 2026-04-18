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

    if (session.role !== 'ADMIN' && session.role !== 'ACCOUNTANT') {
      return NextResponse.json({ error: 'Only admin or accountant can reject leaves' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { reason } = body;

    if (!reason) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
    }

    const existing = await db.leave.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Leave not found' }, { status: 404 });
    }

    if (existing.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only pending leaves can be rejected' }, { status: 400 });
    }

    const leave = await db.leave.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
      },
      include: {
        employee: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    await createAuditLog({
      userId: session.id,
      action: 'REJECT_LEAVE',
      entityType: 'LEAVE',
      entityId: id,
      newValues: { employeeId: existing.employeeId, reason },
    });

    return NextResponse.json({ leave });
  } catch (error: any) {
    console.error('Reject leave error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
