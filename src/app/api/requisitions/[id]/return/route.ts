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

    const canReturn =
      checkPermission(session.role, 'STOCK_MANAGER_APPROVE_MIR') ||
      checkPermission(session.role, 'ADMIN_APPROVE_MIR');

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

    const requisition = await db.requisition.findUnique({ where: { id } });
    if (!requisition) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }

    if (requisition.status === 'REJECTED' || requisition.status === 'RECEIVED') {
      return NextResponse.json(
        { error: 'Cannot return an already rejected or received requisition' },
        { status: 400 }
      );
    }

    const oldValues = formatAuditValues({ status: requisition.status });

    const updatedRequisition = await db.requisition.update({
      where: { id },
      data: {
        status: 'RETURNED',
        returnReason: reason,
      },
      include: {
        site: {
          include: { client: { select: { id: true, name: true } } },
        },
        user: { select: { id: true, name: true, email: true } },
        boqItems: true,
      },
    });

    const newValues = formatAuditValues({
      status: updatedRequisition.status,
      returnReason: reason,
    });

    await createAuditLog({
      userId: session.id,
      action: 'RETURN_MIR',
      entityType: 'REQUISITION',
      entityId: id,
      oldValues,
      newValues,
    });

    return NextResponse.json({ requisition: updatedRequisition });
  } catch (error: any) {
    console.error('Return MIR error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
