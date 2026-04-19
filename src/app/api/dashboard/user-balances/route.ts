import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!checkPermission(session.role, 'VIEW_ALL_EXPENSES')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const siteId = searchParams.get('siteId');
    const month = searchParams.get('month');
    const userId = searchParams.get('userId');

    // Parse month to date range
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined;
    if (month) {
      const [year, mon] = month.split('-').map(Number);
      dateFrom = new Date(year, mon - 1, 1);
      dateTo = new Date(year, mon, 0, 23, 59, 59);
    }

    // Build expense where clause for balance calculation
    const expenseWhere: Prisma.ExpenseWhereInput = {
      status: { in: ['ACCOUNTANT_APPROVED', 'ADMIN_APPROVED', 'PAID'] },
    };

    // Build advance where clause
    const advanceWhere: Prisma.AdvanceWhereInput = {
      status: { in: ['APPROVED', 'PAID'] },
    };

    if (userId) {
      expenseWhere.userId = userId;
      advanceWhere.userId = userId;
    }
    if (clientId) {
      expenseWhere.site = { clientId };
      advanceWhere.site = { clientId };
    }
    if (siteId) {
      expenseWhere.siteId = siteId;
      advanceWhere.siteId = siteId;
    }
    if (dateFrom && dateTo) {
      expenseWhere.expenseDate = { gte: dateFrom, lte: dateTo };
    }

    // Get all users (active only)
    const users = await db.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });

    // If specific userId, only return that user
    const targetUsers = userId ? users.filter((u) => u.id === userId) : users;

    // Optimized: Use GROUP BY instead of N+1 per-user queries (2N+1 → 3 queries)
    const [expenseByUser, advanceByUser] = await Promise.all([
      db.expense.groupBy({
        by: ['userId'],
        where: expenseWhere,
        _sum: { amount: true },
        _count: true,
      }),
      db.advance.groupBy({
        by: ['userId'],
        where: advanceWhere,
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const expenseMap = new Map(expenseByUser.map((e) => [e.userId, { total: e._sum.amount || 0, count: e._count }]));
    const advanceMap = new Map(advanceByUser.map((a) => [a.userId, { total: a._sum.amount || 0, count: a._count }]));

    const balances = targetUsers.map((user) => {
      const exp = expenseMap.get(user.id) || { total: 0, count: 0 };
      const adv = advanceMap.get(user.id) || { total: 0, count: 0 };
      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        totalAdvances: adv.total,
        advanceCount: adv.count,
        totalExpenses: exp.total,
        expenseCount: exp.count,
        balance: adv.total - exp.total,
      };
    });

    return NextResponse.json({ balances });
  } catch (error: any) {
    console.error('User balances error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
