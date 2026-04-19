import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { Role } from '@prisma/client';

// DELETE /api/reset-data — Wipe all data EXCEPT users (ADMIN only)
export async function DELETE(request: NextRequest) {
  try {
    // 1. Auth check — must be ADMIN
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized — not authenticated' }, { status: 401 });
    }
    if (session.role !== Role.ADMIN) {
      return NextResponse.json({ error: 'Forbidden — ADMIN role required' }, { status: 403 });
    }

    // 2. Confirmation check
    const body = await request.json();
    if (!body || body.confirm !== true) {
      return NextResponse.json(
        { error: 'Confirmation required. Include { "confirm": true } in the request body.' },
        { status: 400 },
      );
    }

    // 3. Delete in FK-safe order (users are preserved)
    const results: Record<string, number> = {};

    results.comments = (await db.comment.deleteMany()).count;
    results.attendances = (await db.attendance.deleteMany()).count;
    results.leaves = (await db.leave.deleteMany()).count;
    results.salaries = (await db.salary.deleteMany()).count;
    results.expenses = (await db.expense.deleteMany()).count;
    results.advances = (await db.advance.deleteMany()).count;
    results.boqItems = (await db.bOQItem.deleteMany()).count;
    results.requisitions = (await db.requisition.deleteMany()).count;
    results.auditLogs = (await db.auditLog.deleteMany()).count;
    results.employees = (await db.employee.deleteMany()).count;
    results.sites = (await db.site.deleteMany()).count;
    results.categories = (await db.category.deleteMany()).count;
    results.clients = (await db.client.deleteMany()).count;

    // Clear user session tokens so everyone gets logged out (forces fresh session)
    results.usersReset = (await db.user.updateMany({
      data: { token: null, tokenExpiry: null, lastLogin: null },
    })).count;

    const totalDeleted = Object.values(results).reduce((sum, n) => sum + n, 0);

    return NextResponse.json({
      message: 'All data has been wiped. User accounts are preserved. Please log in again.',
      totalDeleted,
      details: results,
    });
  } catch (error) {
    console.error('[DELETE /api/reset-data] Error:', error);
    return NextResponse.json(
      { error: 'Failed to reset data. Please try again.' },
      { status: 500 },
    );
  }
}
