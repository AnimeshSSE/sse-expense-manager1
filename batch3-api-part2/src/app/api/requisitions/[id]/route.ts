import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog, formatAuditValues } from '@/lib/audit';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;

    const requisition = await db.requisition.findUnique({
      where: { id },
      include: {
        site: {
          include: { client: { select: { id: true, name: true } } },
        },
        user: { select: { id: true, name: true, email: true } },
        boqItems: true,
        stockManagerApprovedBy: { select: { id: true, name: true } },
        adminApprovedBy: { select: { id: true, name: true } },
      },
    });

    if (!requisition) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }

    // Check access
    if (
      !checkPermission(session.role, 'VIEW_ALL_MIRS') &&
      requisition.userId !== session.id
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ requisition });
  } catch (error: any) {
    console.error('Get requisition error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;

    const existingRequisition = await db.requisition.findUnique({
      where: { id },
      include: { boqItems: true },
    });

    if (!existingRequisition) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }

    if (existingRequisition.userId !== session.id) {
      return NextResponse.json(
        { error: 'You can only edit your own requisitions' },
        { status: 403 }
      );
    }

    if (
      existingRequisition.status !== 'PENDING' &&
      existingRequisition.status !== 'RETURNED'
    ) {
      return NextResponse.json(
        { error: 'Can only edit PENDING or RETURNED requisitions' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      title, description, requiredDate, priority,
      notes, attachmentUrl, attachmentName, boqItems,
    } = body;

    const oldValues = formatAuditValues({
      title: existingRequisition.title,
      description: existingRequisition.description,
      requiredDate: existingRequisition.requiredDate,
      priority: existingRequisition.priority,
      totalAmount: existingRequisition.totalAmount,
      boqItemCount: existingRequisition.boqItems.length,
    });

    // Recalculate total amount from BOQ items if provided
    let totalAmount = existingRequisition.totalAmount;
    if (boqItems && Array.isArray(boqItems)) {
      totalAmount = boqItems.reduce((sum: number, item: any) => {
        const quantity = parseFloat(item.quantity) || 0;
        const unitPrice = parseFloat(item.unitPrice) || 0;
        return sum + quantity * unitPrice;
      }, 0);
    }

    const updateData: any = {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description: description || null }),
      ...(requiredDate !== undefined && { requiredDate: new Date(requiredDate) }),
      ...(priority !== undefined && { priority }),
      ...(notes !== undefined && { notes: notes || null }),
      ...(attachmentUrl !== undefined && { attachmentUrl: attachmentUrl || null }),
      ...(attachmentName !== undefined && { attachmentName: attachmentName || null }),
      totalAmount,
    };

    // If status was RETURNED, set back to PENDING on edit
    if (existingRequisition.status === 'RETURNED') {
      updateData.status = 'PENDING';
      updateData.returnReason = null;
    }

    // Handle BOQ items update
    if (boqItems && Array.isArray(boqItems)) {
      // Delete existing BOQ items and create new ones
      await db.bOQItem.deleteMany({ where: { requisitionId: id } });

      updateData.boqItems = {
        create: boqItems.map((item: any) => ({
          itemName: item.itemName,
          description: item.description || null,
          quantity: parseFloat(item.quantity) || 0,
          unit: item.unit || '',
          unitPrice: parseFloat(item.unitPrice) || 0,
          totalPrice: (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0),
          category: item.category || null,
          notes: item.notes || null,
        })),
      };
    }

    const requisition = await db.requisition.update({
      where: { id },
      data: updateData,
      include: {
        site: {
          include: { client: { select: { id: true, name: true } } },
        },
        user: { select: { id: true, name: true, email: true } },
        boqItems: true,
      },
    });

    const newValues = formatAuditValues(updateData);

    await createAuditLog({
      userId: session.id,
      action: 'UPDATE_REQUISITION',
      entityType: 'REQUISITION',
      entityId: id,
      oldValues,
      newValues,
    });

    return NextResponse.json({ requisition });
  } catch (error: any) {
    console.error('Update requisition error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;

    const requisition = await db.requisition.findUnique({ where: { id } });
    if (!requisition) {
      return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });
    }

    if (requisition.userId !== session.id) {
      return NextResponse.json(
        { error: 'You can only delete your own requisitions' },
        { status: 403 }
      );
    }

    if (requisition.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Can only delete PENDING requisitions' },
        { status: 400 }
      );
    }

    const oldValues = formatAuditValues({
      id: requisition.id,
      title: requisition.title,
      totalAmount: requisition.totalAmount,
      status: requisition.status,
    });

    // BOQ items will be cascade deleted
    await db.requisition.delete({ where: { id } });

    await createAuditLog({
      userId: session.id,
      action: 'DELETE_REQUISITION',
      entityType: 'REQUISITION',
      entityId: id,
      oldValues,
    });

    return NextResponse.json({ message: 'Requisition deleted successfully' });
  } catch (error: any) {
    console.error('Delete requisition error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
