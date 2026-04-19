import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog, formatAuditValues } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (session.role !== 'ADMIN' && session.role !== 'ACCOUNTANT') {
      return NextResponse.json({ error: 'Only admin or accountant can bulk mark attendance' }, { status: 403 });
    }

    const body = await request.json();
    const { date, records } = body;

    if (!date || !records || !Array.isArray(records) || !records.length) {
      return NextResponse.json({ error: 'Date and records array are required' }, { status: 400 });
    }

    const dateObj = new Date(date);
    const created = [];
    const errors: string[] = [];

    for (const record of records) {
      const { employeeId, status, checkIn, checkOut, notes } = record;

      if (!employeeId) {
        errors.push('Missing employeeId in one of the records');
        continue;
      }

      const employee = await db.employee.findUnique({ where: { id: employeeId } });
      if (!employee) {
        errors.push(`Employee not found: ${employeeId}`);
        continue;
      }

      const attendance = await db.attendance.upsert({
        where: {
          employeeId_date: {
            employeeId,
            date: dateObj,
          },
        },
        create: {
          employeeId,
          date: dateObj,
          status: status || 'PRESENT',
          checkIn: checkIn ? new Date(checkIn) : null,
          checkOut: checkOut ? new Date(checkOut) : null,
          notes: notes || null,
        },
        update: {
          status: status || undefined,
          checkIn: checkIn ? new Date(checkIn) : undefined,
          checkOut: checkOut ? new Date(checkOut) : undefined,
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
      action: 'BULK_MARK_ATTENDANCE',
      entityType: 'ATTENDANCE',
      newValues: formatAuditValues({ date, count: created.length }),
    });

    return NextResponse.json({
      attendances: created,
      count: created.length,
      errors: errors.length > 0 ? errors : undefined,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Bulk mark attendance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
