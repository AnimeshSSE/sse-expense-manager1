import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog, formatAuditValues } from '@/lib/audit';
import { Prisma, LeaveType, LeaveStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const isAdminOrAccountant = session.role === 'ADMIN' || session.role === 'ACCOUNTANT';

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const where: Prisma.LeaveWhereInput = {};

    if (!isAdminOrAccountant) {
      where.employeeId = session.id;
    }
    if (employeeId) where.employeeId = employeeId;
    if (status) {
      const statuses = status.split(',').filter(Boolean) as LeaveStatus[];
      if (statuses.length === 1) where.status = statuses[0];
      else if (statuses.length > 1) where.status = { in: statuses };
    }
    if (type) {
      const types = type.split(',').filter(Boolean) as LeaveType[];
      if (types.length === 1) where.type = types[0];
      else if (types.length > 1) where.type = { in: types };
    }
    if (dateFrom || dateTo) {
      where.startDate = {
        ...(dateFrom && { gte: new Date(dateFrom) }),
      };
      where.endDate = {
        ...(dateTo && { lte: new Date(dateTo) }),
      };
    }

    const [leaves, total] = await Promise.all([
      db.leave.findMany({
        where,
        include: {
          employee: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
          approvedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.leave.count({ where }),
    ]);

    return NextResponse.json({
      leaves,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error: any) {
    console.error('Get leaves error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { employeeId, type, startDate, endDate, totalDays, reason } = body;

    // User can apply leave for themselves; admin/accountant can apply for anyone
    const isAdminOrAccountant = session.role === 'ADMIN' || session.role === 'ACCOUNTANT';
    const targetEmployeeId = employeeId || session.id;

    // Non-admin must be applying for themselves
    if (!isAdminOrAccountant && employeeId && employeeId !== session.id) {
      return NextResponse.json({ error: 'You can only apply leave for yourself' }, { status: 403 });
    }

    // Check employee exists
    const employee = await db.employee.findUnique({ where: { id: targetEmployeeId } });
    if (!employee) {
      return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
    }

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
    }

    // Calculate total days if not provided
    let days = totalDays;
    if (!days) {
      const diffTime = Math.abs(end.getTime() - start.getTime());
      days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    const leave = await db.leave.create({
      data: {
        employeeId: targetEmployeeId,
        type: type || 'CASUAL',
        startDate: start,
        endDate: end,
        totalDays: parseFloat(days),
        reason: reason || null,
        status: 'PENDING',
      },
      include: {
        employee: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    await createAuditLog({
      userId: session.id,
      action: 'CREATE_LEAVE',
      entityType: 'LEAVE',
      entityId: leave.id,
      newValues: formatAuditValues({ employeeId: targetEmployeeId, type: type || 'CASUAL', startDate, endDate, totalDays: days }),
    });

    return NextResponse.json({ leave }, { status: 201 });
  } catch (error: any) {
    console.error('Create leave error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
