import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog, formatAuditValues } from '@/lib/audit';
import { ExpenseStatus } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { ids, action } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'IDs array is required' }, { status: 400 });
    }

    if (!['approve-accountant', 'approve-admin', 'reject', 'mark-paid'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Permission checks
    if ((action === 'approve-accountant' || action === 'mark-paid') && !checkPermission(session.role, 'ACCOUNTANT_APPROVE_EXPENSE')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (action === 'approve-admin' && !checkPermission(session.role, 'ADMIN_APPROVE_EXPENSE')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (action === 'reject' && !checkPermission(session.role, 'ACCOUNTANT_APPROVE_EXPENSE')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let updatedCount = 0;
    let errors: string[] = [];

    for (const id of ids) {
      try {
        const expense = await db.expense.findUnique({ where: { id } });
        if (!expense) {
          errors.push(`${id}: not found`);
          continue;
        }

        const updateData: any = {};
        let newStatus: ExpenseStatus | null = null;

        switch (action) {
          case 'approve-accountant':
            if (expense.status !== 'PENDING') {
              errors.push(`${id}: status is ${expense.status}, expected PENDING`);
              continue;
            }
            updateData.status = 'ACCOUNTANT_APPROVED';
            updateData.accountantApprovedById = session.id;
            updateData.accountantApprovedAt = new Date();
            newStatus = 'ACCOUNTANT_APPROVED';
            break;
          case 'approve-admin':
            if (expense.status !== 'ACCOUNTANT_APPROVED') {
              errors.push(`${id}: status is ${expense.status}, expected ACCOUNTANT_APPROVED`);
              continue;
            }
            updateData.status = 'ADMIN_APPROVED';
            updateData.adminApprovedById = session.id;
            updateData.adminApprovedAt = new Date();
            newStatus = 'ADMIN_APPROVED';
            break;
          case 'reject':
            if (!['PENDING', 'ACCOUNTANT_APPROVED'].includes(expense.status)) {
              errors.push(`${id}: status is ${expense.status}, cannot reject`);
              continue;
            }
            updateData.status = 'REJECTED';
            updateData.rejectionReason = 'Bulk rejected';
            newStatus = 'REJECTED';
            break;
          case 'mark-paid':
            if (expense.status !== 'ADMIN_APPROVED') {
              errors.push(`${id}: status is ${expense.status}, expected ADMIN_APPROVED`);
              continue;
            }
            updateData.status = 'PAID';
            newStatus = 'PAID';
            break;
        }

        await db.expense.update({ where: { id }, data: updateData });

        await createAuditLog({
          userId: session.id,
          action: `BULK_${action.toUpperCase()}_EXPENSE`,
          entityType: 'EXPENSE',
          entityId: id,
          newValues: formatAuditValues({ status: newStatus }),
        });

        updatedCount++;
      } catch (e: any) {
        errors.push(`${id}: ${e.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      updatedCount,
      totalRequested: ids.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Bulk expense action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
