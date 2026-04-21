import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (!checkPermission(session.role, 'ACCOUNTANT_APPROVE_EXPENSE')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const advance = await db.advance.findUnique({ where: { id } });
    if (!advance) return NextResponse.json({ error: 'Advance not found' }, { status: 404 });
    if (advance.status !== 'PENDING') return NextResponse.json({ error: 'Only pending advances can be approved' }, { status: 400 });

    // Auto-pay: Accountant approval directly marks as PAID (no separate admin approval needed)
    const updated = await db.advance.update({
      where: { id },
      data: {
        status: 'PAID',
        accountantApprovedById: session.id,
        accountantApprovedAt: new Date(),
        paidById: session.id,
        paidAt: new Date(),
      },
      include: { site: { include: { client: { select: { id: true, name: true } } } }, user: { select: { id: true, name: true } } },
    });
    await createAuditLog({ userId: session.id, action: 'APPROVE_ADVANCE_ACCOUNTANT', entityType: 'ADVANCE', entityId: id });
    await createAuditLog({ userId: session.id, action: 'PAY_ADVANCE', entityType: 'ADVANCE', entityId: id });
    return NextResponse.json({ advance: updated });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
