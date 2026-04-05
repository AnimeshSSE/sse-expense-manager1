import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog, formatAuditValues } from '@/lib/audit';
import { RequisitionStatus } from '@prisma/client';

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

    if (!['approve-stock-manager', 'approve-admin', 'reject', 'order'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Permission checks
    if (action === 'approve-stock-manager' && session.role !== 'STOCK_MANAGER' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (action === 'approve-admin' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (action === 'reject' && session.role !== 'STOCK_MANAGER' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (action === 'order' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let updatedCount = 0;
    let errors: string[] = [];

    for (const id of ids) {
      try {
        const req = await db.requisition.findUnique({ where: { id } });
        if (!req) {
          errors.push(`${id}: not found`);
          continue;
        }

        const updateData: any = {};
        let newStatus: RequisitionStatus | null = null;

        switch (action) {
          case 'approve-stock-manager':
            if (req.status !== 'PENDING') {
              errors.push(`${id}: status is ${req.status}, expected PENDING`);
              continue;
            }
            updateData.status = 'STOCK_MANAGER_APPROVED';
            updateData.stockManagerApprovedById = session.id;
            updateData.stockManagerApprovedAt = new Date();
            newStatus = 'STOCK_MANAGER_APPROVED';
            break;
          case 'approve-admin':
            if (req.status !== 'STOCK_MANAGER_APPROVED') {
              errors.push(`${id}: status is ${req.status}, expected STOCK_MANAGER_APPROVED`);
              continue;
            }
            updateData.status = 'ADMIN_APPROVED';
            updateData.adminApprovedById = session.id;
            updateData.adminApprovedAt = new Date();
            newStatus = 'ADMIN_APPROVED';
            break;
          case 'reject':
            if (!['PENDING', 'STOCK_MANAGER_APPROVED'].includes(req.status)) {
              errors.push(`${id}: status is ${req.status}, cannot reject`);
              continue;
            }
            updateData.status = 'REJECTED';
            updateData.rejectionReason = 'Bulk rejected';
            newStatus = 'REJECTED';
            break;
          case 'order':
            if (req.status !== 'ADMIN_APPROVED') {
              errors.push(`${id}: status is ${req.status}, expected ADMIN_APPROVED`);
              continue;
            }
            updateData.status = 'ORDERED';
            newStatus = 'ORDERED';
            break;
        }

        await db.requisition.update({ where: { id }, data: updateData });

        await createAuditLog({
          userId: session.id,
          action: `BULK_${action.toUpperCase().replace(/-/g, '_')}_REQUISITION`,
          entityType: 'REQUISITION',
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
    console.error('Bulk requisition action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
