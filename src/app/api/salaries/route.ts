import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog, formatAuditValues } from '@/lib/audit';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (session.role !== 'ADMIN' && session.role !== 'ACCOUNTANT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const month = searchParams.get('month');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const validSortFields = ['createdAt', 'month', 'baseSalary', 'netSalary', 'status', 'paidDate'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortDirection = sortOrder === 'asc' ? 'asc' : 'desc';

    const where: Prisma.SalaryWhereInput = {};
    if (employeeId) where.employeeId = employeeId;
    if (month) where.month = month;
    if (status) where.status = status;

    const [salaries, total] = await Promise.all([
      db.salary.findMany({
        where,
        include: {
          employee: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
        orderBy: { [sortField]: sortDirection },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.salary.count({ where }),
    ]);

    return NextResponse.json({
      salaries,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error: any) {
    console.error('Get salaries error:', error);
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
      return NextResponse.json({ error: 'Only admin or accountant can create salary records' }, { status: 403 });
    }

    const body = await request.json();
    const { employeeId, month, baseSalary, hra, da, ta, bonus, deductions, pf, tds, advanceDeduction, paymentMethod, notes } = body;

    if (!employeeId || !month || baseSalary === undefined) {
      return NextResponse.json({ error: 'Employee ID, month, and base salary are required' }, { status: 400 });
    }

    const employee = await db.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Check for duplicate salary record
    const existing = await db.salary.findFirst({ where: { employeeId, month } });
    if (existing) {
      return NextResponse.json({ error: 'Salary record already exists for this employee and month' }, { status: 409 });
    }

    const base = parseFloat(baseSalary) || 0;
    const hraVal = parseFloat(hra) || 0;
    const daVal = parseFloat(da) || 0;
    const taVal = parseFloat(ta) || 0;
    const bonusVal = parseFloat(bonus) || 0;
    const deductionsVal = parseFloat(deductions) || 0;
    const pfVal = parseFloat(pf) || 0;
    const tdsVal = parseFloat(tds) || 0;
    const advanceDeductionVal = parseFloat(advanceDeduction) || 0;

    const netSalary = base + hraVal + daVal + taVal + bonusVal - deductionsVal - pfVal - tdsVal - advanceDeductionVal;

    const salary = await db.salary.create({
      data: {
        employeeId,
        month,
        baseSalary: base,
        hra: hraVal,
        da: daVal,
        ta: taVal,
        bonus: bonusVal,
        deductions: deductionsVal,
        pf: pfVal,
        tds: tdsVal,
        advanceDeduction: advanceDeductionVal,
        netSalary,
        paymentMethod: paymentMethod || 'BANK_TRANSFER',
        notes: notes || null,
      },
      include: {
        employee: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    await createAuditLog({
      userId: session.id,
      action: 'CREATE_SALARY',
      entityType: 'SALARY',
      entityId: salary.id,
      newValues: formatAuditValues({ employeeId, month, baseSalary: base, netSalary }),
    });

    return NextResponse.json({ salary }, { status: 201 });
  } catch (error: any) {
    console.error('Create salary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
