import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog, formatAuditValues } from '@/lib/audit';

// GET single advance
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { id } = await params;
    const advance = await db.advance.findUnique({
      where: { id },
      include: {
        site: { include: { client: { select: { id: true, name: true } } } },
        user: { select: { id: true, name: true, email: true } },
        accountantApprovedBy: { select: { id: true, name: true } },
        adminApprovedBy: { select: { id: true, name: true } },
        paidBy: { select: { id: true, name: true } },
      },
    });
    if (!advance) {
      return NextResponse.json({ error: 'Advance not found' }, { status: 404 });
    }
    if (!checkPermission(session.role, 'VIEW_ALL_EXPENSES') && advance.userId !== session.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ advance });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT update advance
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { id } = await params;
    const body = await request.json();

    const existing = await db.advance.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Advance not found' }, { status: 404 });
    }

    // Only allow editing returned advances or admin editing non-final
    if (session.role !== 'ADMIN' && (existing.status !== 'RETURNED' || existing.userId !== session.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const advance = await db.advance.update({
      where: { id },
      data: {
        amount: body.amount !== undefined ? parseFloat(body.amount) : undefined,
        purpose: body.purpose,
        notes: body.notes,
      },
      include: {
        site: { include: { client: { select: { id: true, name: true } } } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await createAuditLog({
      userId: session.id,
      action: 'UPDATE_ADVANCE',
      entityType: 'ADVANCE',
      entityId: id,
      oldValues: formatAuditValues({ amount: existing.amount, purpose: existing.purpose }),
      newValues: formatAuditValues(body),
    });

    return NextResponse.json({ advance });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE advance (only own pending or admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const { id } = await params;
    const existing = await db.advance.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Advance not found' }, { status: 404 });
    }
    if (session.role !== 'ADMIN' && (existing.status !== 'PENDING' || existing.userId !== session.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.advance.delete({ where: { id } });
    await createAuditLog({
      userId: session.id,
      action: 'DELETE_ADVANCE',
      entityType: 'ADVANCE',
      entityId: id,
      oldValues: formatAuditValues({ amount: existing.amount, purpose: existing.purpose }),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
