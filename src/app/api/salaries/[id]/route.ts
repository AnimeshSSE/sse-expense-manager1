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

    const salary = await db.salary.findUnique({
      where: { id },
      include: {
        employee: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!salary) {
      return NextResponse.json({ error: 'Salary not found' }, { status: 404 });
    }

    return NextResponse.json({ salary });
  } catch (error: any) {
    console.error('Get salary error:', error);
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

    if (session.role !== 'ADMIN' && session.role !== 'ACCOUNTANT') {
      return NextResponse.json({ error: 'Only admin or accountant can update salary records' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.salary.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Salary not found' }, { status: 404 });
    }

    if (existing.status === 'PAID') {
      return NextResponse.json({ error: 'Cannot update a paid salary record' }, { status: 400 });
    }

    const oldValues = formatAuditValues(existing);
    const updateData: any = {};

    const numericFields = ['baseSalary', 'hra', 'da', 'ta', 'bonus', 'deductions', 'pf', 'tds', 'advanceDeduction'];
    for (const field of numericFields) {
      if (body[field] !== undefined) {
        updateData[field] = parseFloat(body[field]) || 0;
      }
    }

    const stringFields = ['paymentMethod', 'notes', 'status'];
    for (const field of stringFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Recalculate netSalary if any numeric fields changed
    if (numericFields.some(f => body[f] !== undefined)) {
      const base = updateData.baseSalary !== undefined ? updateData.baseSalary : existing.baseSalary;
      const hraVal = updateData.hra !== undefined ? updateData.hra : existing.hra;
      const daVal = updateData.da !== undefined ? updateData.da : existing.da;
      const taVal = updateData.ta !== undefined ? updateData.ta : existing.ta;
      const bonusVal = updateData.bonus !== undefined ? updateData.bonus : existing.bonus;
      const deductionsVal = updateData.deductions !== undefined ? updateData.deductions : existing.deductions;
      const pfVal = updateData.pf !== undefined ? updateData.pf : existing.pf;
      const tdsVal = updateData.tds !== undefined ? updateData.tds : existing.tds;
      const advanceDeductionVal = updateData.advanceDeduction !== undefined ? updateData.advanceDeduction : existing.advanceDeduction;
      updateData.netSalary = base + hraVal + daVal + taVal + bonusVal - deductionsVal - pfVal - tdsVal - advanceDeductionVal;
    }

    const salary = await db.salary.update({
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
      action: 'UPDATE_SALARY',
      entityType: 'SALARY',
      entityId: id,
      oldValues,
      newValues: formatAuditValues(updateData),
    });

    return NextResponse.json({ salary });
  } catch (error: any) {
    console.error('Update salary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
