import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog, formatAuditValues } from '@/lib/audit';

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

    const isAdminOrAccountant = session.role === 'ADMIN' || session.role === 'ACCOUNTANT';

    const where: any = { id };
    if (!isAdminOrAccountant) {
      where.employeeId = session.id;
    }

    const leave = await db.leave.findFirst({
      where,
      include: {
        employee: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    if (!leave) {
      return NextResponse.json({ error: 'Leave not found' }, { status: 404 });
    }

    return NextResponse.json({ leave });
  } catch (error: any) {
    console.error('Get leave error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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

    const existing = await db.leave.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Leave not found' }, { status: 404 });
    }

    // Only PENDING leaves can be updated
    if (existing.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only pending leaves can be updated' }, { status: 400 });
    }

    // Only the owner can update their own leave
    const employee = await db.employee.findUnique({ where: { id: existing.employeeId } });
    if (!employee || (employee.userId !== session.id && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'You can only update your own leave' }, { status: 403 });
    }

    const oldValues = formatAuditValues({ type: existing.type, startDate: existing.startDate, endDate: existing.endDate, reason: existing.reason });

    const startDate = body.startDate ? new Date(body.startDate) : undefined;
    const endDate = body.endDate ? new Date(body.endDate) : undefined;

    const updateData: any = {};
    if (body.type !== undefined) updateData.type = body.type;
    if (startDate) updateData.startDate = startDate;
    if (endDate) updateData.endDate = endDate;
    if (body.reason !== undefined) updateData.reason = body.reason;
    if (startDate || endDate) {
      const start = startDate || existing.startDate;
      const end = endDate || existing.endDate;
      if (body.totalDays) {
        updateData.totalDays = parseFloat(body.totalDays);
      } else {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        updateData.totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      }
    }

    const leave = await db.leave.update({
      where: { id },
      data: updateData,
      include: {
        employee: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    await createAuditLog({
      userId: session.id,
      action: 'UPDATE_LEAVE',
      entityType: 'LEAVE',
      entityId: id,
      oldValues,
      newValues: formatAuditValues(updateData),
    });

    return NextResponse.json({ leave });
  } catch (error: any) {
    console.error('Update leave error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
