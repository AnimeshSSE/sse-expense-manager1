import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog, formatAuditValues } from '@/lib/audit';
import { AttendanceStatus } from '@/lib/prisma-constants';

type AttendanceWhereInput = {
  employeeId?: string;
  status?: string | { in: string[] };
  date?: { gte?: Date; lte?: Date };
};

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const isAdminOrAccountant = session.role === 'ADMIN' || session.role === 'ACCOUNTANT';
    if (!isAdminOrAccountant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const where: AttendanceWhereInput = {};

    if (employeeId) where.employeeId = employeeId;
    if (status) {
      const statuses = status.split(',').filter(Boolean);
      if (statuses.length === 1) where.status = statuses[0];
      else if (statuses.length > 1) where.status = { in: statuses };
    }
    if (dateFrom || dateTo) {
      where.date = {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo) }),
      };
    }

    const [attendances, total] = await Promise.all([
      db.attendance.findMany({
        where,
        include: {
          employee: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.attendance.count({ where }),
    ]);

    return NextResponse.json({
      attendances,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error: any) {
    console.error('Get attendance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (session.role !== 'ADMIN' && session.role !== 'ACCOUNTANT') {
      return NextResponse.json({ error: 'Only admin or accountant can mark attendance' }, { status: 403 });
    }

    const body = await request.json();
    const records = Array.isArray(body) ? body : [body];

    if (!records.length) {
      return NextResponse.json({ error: 'No attendance records provided' }, { status: 400 });
    }

    const created: any[] = [];

    for (const record of records) {
      const { employeeId, date, status, checkIn, checkOut, hoursWorked, overtimeHours, notes } = record;

      if (!employeeId || !date) {
        continue;
      }

      const employee = await db.employee.findUnique({ where: { id: employeeId } });
      if (!employee) continue;

      // Upsert: use unique constraint on [employeeId, date]
      const attendance = await db.attendance.upsert({
        where: {
          employeeId_date: {
            employeeId,
            date: new Date(date),
          },
        },
        create: {
          employeeId,
          date: new Date(date),
          status: status || 'PRESENT',
          checkIn: checkIn ? new Date(checkIn) : null,
          checkOut: checkOut ? new Date(checkOut) : null,
          hoursWorked: hoursWorked ? parseFloat(hoursWorked) : 0,
          overtimeHours: overtimeHours ? parseFloat(overtimeHours) : 0,
          notes: notes || null,
        },
        update: {
          status: status || undefined,
          checkIn: checkIn ? new Date(checkIn) : undefined,
          checkOut: checkOut ? new Date(checkOut) : undefined,
          hoursWorked: hoursWorked ? parseFloat(hoursWorked) : undefined,
          overtimeHours: overtimeHours ? parseFloat(overtimeHours) : undefined,
          notes: notes !== undefined ? notes : undefined,
        },
        include: {
          employee: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      });

      created.push(attendance);
    }

    await createAuditLog({
      userId: session.id,
      action: 'MARK_ATTENDANCE',
      entityType: 'ATTENDANCE',
      newValues: formatAuditValues({ count: created.length }),
    });

    return NextResponse.json({ attendances: created, count: created.length }, { status: 201 });
  } catch (error: any) {
    console.error('Mark attendance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
