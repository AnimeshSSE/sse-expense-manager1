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

    if (!checkPermission(session.role, 'SUBMIT_MIR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    const requisition = await db.requisition.findUnique({ where: { id } });
    if (!requisition) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }

    if (requisition.userId !== session.id) {
      return NextResponse.json(
        { error: 'You can only resubmit your own requisitions' },
        { status: 403 }
      );
    }

    if (requisition.status !== 'RETURNED') {
      return NextResponse.json(
        { error: 'Requisition must be in RETURNED status to resubmit' },
        { status: 400 }
      );
    }

    const oldValues = formatAuditValues({
      status: requisition.status,
      returnReason: requisition.returnReason,
    });

    const updatedRequisition = await db.requisition.update({
      where: { id },
      data: {
        status: 'PENDING',
        returnReason: null,
      },
      include: {
        site: {
          include: { client: { select: { id: true, name: true } } },
        },
        user: { select: { id: true, name: true, email: true } },
        boqItems: true,
      },
    });

    const newValues = formatAuditValues({ status: updatedRequisition.status });

    await createAuditLog({
      userId: session.id,
      action: 'RESUBMIT_MIR',
      entityType: 'REQUISITION',
      entityId: id,
      oldValues,
      newValues,
    });

    return NextResponse.json({ requisition: updatedRequisition });
  } catch (error: any) {
    console.error('Resubmit MIR error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
