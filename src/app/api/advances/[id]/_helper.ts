import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
// Shared helper for advance actions
async function handleAction(
  request: NextRequest,
  params: Promise<{ id: string }>,
  action: 'approve-accountant' | 'approve-admin' | 'reject' | 'return' | 'mark-paid'
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const { id } = await params;

  const advance = await db.advance.findUnique({ where: { id } });
  if (!advance) return NextResponse.json({ error: 'Advance not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const reason = body.reason || '';

  let data: Record<string, any> = {};

  switch (action) {
    case 'approve-accountant':
      if (advance.status !== 'PENDING') return NextResponse.json({ error: 'Only pending advances can be approved' }, { status: 400 });
      data = { status: 'APPROVED', accountantApprovedById: session.id, accountantApprovedAt: new Date() };
      break;
    case 'approve-admin':
      if (advance.status !== 'APPROVED') return NextResponse.json({ error: 'Only approved advances can be admin approved' }, { status: 400 });
      data = { status: 'APPROVED', adminApprovedById: session.id, adminApprovedAt: new Date() };
      break;
    case 'reject':
      if (!['PENDING', 'APPROVED'].includes(advance.status)) return NextResponse.json({ error: 'Cannot reject at this stage' }, { status: 400 });
      if (!reason) return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
      data = { status: 'REJECTED', rejectionReason: reason };
      break;
    case 'return':
      if (!['PENDING', 'APPROVED'].includes(advance.status)) return NextResponse.json({ error: 'Cannot return at this stage' }, { status: 400 });
      if (!reason) return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
      data = { status: 'RETURNED', returnReason: reason };
      break;
    case 'mark-paid':
      if (advance.status !== 'APPROVED') return NextResponse.json({ error: 'Only approved advances can be marked as paid' }, { status: 400 });
      data = { status: 'PAID', paidById: session.id, paidAt: new Date() };
      break;
  }

  const updated = await db.advance.update({
    where: { id },
    data,
    include: {
      site: { include: { client: { select: { id: true, name: true } } } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  await createAuditLog({
    userId: session.id,
    action: action.toUpperCase().replace(/-/g, '_'),
    entityType: 'ADVANCE',
    entityId: id,
    newValues: reason ? { reason } : undefined,
  });

  return NextResponse.json({ advance: updated });
}

// Each file re-exports from a shared handler but needs to be separate files for Next.js routing
export { handleAction };
