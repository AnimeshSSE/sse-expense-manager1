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
      where.userId = session.id;
    }

    const employee = await db.employee.findFirst({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
        salaries: {
          orderBy: { month: 'desc' },
          take: 1,
        },
        _count: {
          select: { attendances: true, leaves: true, salaries: true },
        },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    return NextResponse.json({ employee });
  } catch (error: any) {
    console.error('Get employee error:', error);
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

    if (session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admin can update employees' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.employee.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const oldValues = formatAuditValues(existing);
    const updateData: any = {};

    const allowedFields = ['designation', 'department', 'phone', 'address', 'baseSalary', 'bankAccount', 'bankName', 'bankIfsc', 'panNumber', 'aadhaarNumber', 'isActive'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'baseSalary') {
          updateData[field] = parseFloat(body[field]);
        } else if (field === 'isActive') {
          updateData[field] = body[field] === true;
        } else {
          updateData[field] = body[field];
        }
      }
    }

    const employee = await db.employee.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
      },
    });

    await createAuditLog({
      userId: session.id,
      action: 'UPDATE_EMPLOYEE',
      entityType: 'EMPLOYEE',
      entityId: id,
      oldValues,
      newValues: formatAuditValues(updateData),
    });

    return NextResponse.json({ employee });
  } catch (error: any) {
    console.error('Update employee error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admin can delete employees' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.employee.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const employee = await db.employee.update({
      where: { id },
      data: { isActive: false },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
      },
    });

    await createAuditLog({
      userId: session.id,
      action: 'DELETE_EMPLOYEE',
      entityType: 'EMPLOYEE',
      entityId: id,
      oldValues: formatAuditValues({ employeeCode: existing.employeeCode, designation: existing.designation }),
    });

    return NextResponse.json({ employee });
  } catch (error: any) {
    console.error('Delete employee error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
