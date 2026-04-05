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

    if (!checkPermission(session.role, 'STOCK_MANAGER_APPROVE_MIR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    const requisition = await db.requisition.findUnique({ where: { id } });
    if (!requisition) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }

    if (requisition.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Requisition must be in PENDING status to approve' },
        { status: 400 }
      );
    }

    const oldValues = formatAuditValues({ status: requisition.status });

    const updatedRequisition = await db.requisition.update({
      where: { id },
      data: {
        status: 'STOCK_MANAGER_APPROVED',
        stockManagerApprovedById: session.id,
        stockManagerApprovedAt: new Date(),
      },
      include: {
        site: {
          include: { client: { select: { id: true, name: true } } },
        },
        user: { select: { id: true, name: true, email: true } },
        boqItems: true,
        stockManagerApprovedBy: { select: { id: true, name: true } },
      },
    });

    const newValues = formatAuditValues({
      status: updatedRequisition.status,
      stockManagerApprovedById: session.id,
    });

    await createAuditLog({
      userId: session.id,
      action: 'STOCK_MANAGER_APPROVE_MIR',
      entityType: 'REQUISITION',
      entityId: id,
      oldValues,
      newValues,
    });

    return NextResponse.json({ requisition: updatedRequisition });
  } catch (error: any) {
    console.error('Stock manager approve MIR error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
