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

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view');

    // If view=balances, return user balance data
    if (view === 'balances') {
      return handleUserBalances(searchParams, session);
    }

    const viewAsUserId = searchParams.get('userId');
    const clientId = searchParams.get('clientId');
    const siteId = searchParams.get('siteId');
    const month = searchParams.get('month');

    const now = new Date();
    let startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined;

    if (month) {
      const [year, mon] = month.split('-').map(Number);
      startOfMonth = new Date(year, mon - 1, 1);
      endOfMonth = new Date(year, mon, 0, 23, 59, 59);
      dateFrom = startOfMonth;
      dateTo = endOfMonth;
    }

    // Build role-based expense filters
    const expenseWhere: Prisma.ExpenseWhereInput = {};
    if (viewAsUserId && checkPermission(session.role, 'VIEW_ALL_EXPENSES')) {
      expenseWhere.userId = viewAsUserId;
    } else if (!checkPermission(session.role, 'VIEW_ALL_EXPENSES')) {
      expenseWhere.userId = session.id;
    }

    if (clientId) {
      expenseWhere.site = { clientId };
    }
    if (siteId) {
      expenseWhere.siteId = siteId;
    }

    const mirWhere: Prisma.RequisitionWhereInput = {};
    if (viewAsUserId && checkPermission(session.role, 'VIEW_ALL_MIRS')) {
      mirWhere.userId = viewAsUserId;
    } else if (!checkPermission(session.role, 'VIEW_ALL_MIRS')) {
      mirWhere.userId = session.id;
    }

    if (clientId) {
      mirWhere.site = { clientId };
    }
    if (siteId) {
      mirWhere.siteId = siteId;
    }

    const thisMonthExpenseWhere: Prisma.ExpenseWhereInput = {
      ...expenseWhere,
      expenseDate: { gte: dateFrom || startOfMonth, lte: dateTo || endOfMonth },
    };

    const thisMonthMirWhere: Prisma.RequisitionWhereInput = {
      ...mirWhere,
      createdAt: { gte: dateFrom || startOfMonth, lte: dateTo || endOfMonth },
    };

    const [
      thisMonthExpenses,
      pendingExpenses,
      accountantApprovedExpenses,
      adminApprovedExpenses,
      paidExpenses,
      pendingMirs,
      stockMgrApprovedMirs,
      adminApprovedMirs,
      thisMonthMirs,
      recentExpenses,
      recentMirs,
    ] = await Promise.all([
      db.expense.aggregate({
        where: thisMonthExpenseWhere,
        _sum: { amount: true },
        _count: true,
      }),
      db.expense.aggregate({
        where: { ...expenseWhere, status: 'PENDING' },
        _sum: { amount: true },
        _count: true,
      }),
      db.expense.aggregate({
        where: { ...expenseWhere, status: 'ACCOUNTANT_APPROVED' },
        _sum: { amount: true },
        _count: true,
      }),
      db.expense.aggregate({
        where: { ...expenseWhere, status: 'ADMIN_APPROVED' },
        _sum: { amount: true },
        _count: true,
      }),
      db.expense.aggregate({
        where: { ...expenseWhere, status: 'PAID' },
        _sum: { amount: true },
        _count: true,
      }),
      db.requisition.aggregate({
        where: { ...mirWhere, status: 'PENDING' },
        _sum: { totalAmount: true },
        _count: true,
      }),
      db.requisition.aggregate({
        where: { ...mirWhere, status: 'STOCK_MANAGER_APPROVED' },
        _sum: { totalAmount: true },
        _count: true,
      }),
      db.requisition.aggregate({
        where: { ...mirWhere, status: 'ADMIN_APPROVED' },
        _sum: { totalAmount: true },
        _count: true,
      }),
      db.requisition.aggregate({
        where: thisMonthMirWhere,
        _sum: { totalAmount: true },
        _count: true,
      }),
      db.expense.findMany({
        where: expenseWhere,
        include: {
          site: { include: { client: { select: { name: true } } } },
          category: { select: { name: true } },
          user: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      db.requisition.findMany({
        where: mirWhere,
        include: {
          site: { include: { client: { select: { name: true } } } },
          user: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    return NextResponse.json({
      thisMonthExpenses: {
        total: thisMonthExpenses._sum.amount || 0,
        count: thisMonthExpenses._count,
      },
      pendingExpenses: {
        count: pendingExpenses._count,
        total: pendingExpenses._sum.amount || 0,
      },
      accountantApprovedExpenses: {
        count: accountantApprovedExpenses._count,
        total: accountantApprovedExpenses._sum.amount || 0,
      },
      adminApprovedExpenses: {
        count: adminApprovedExpenses._count,
        total: adminApprovedExpenses._sum.amount || 0,
      },
      paidExpenses: {
        count: paidExpenses._count,
        total: paidExpenses._sum.amount || 0,
      },
      pendingMirs: {
        count: pendingMirs._count,
        total: pendingMirs._sum.totalAmount || 0,
      },
      stockMgrApprovedMirs: {
        count: stockMgrApprovedMirs._count,
        total: stockMgrApprovedMirs._sum.totalAmount || 0,
      },
      adminApprovedMirs: {
        count: adminApprovedMirs._count,
        total: adminApprovedMirs._sum.totalAmount || 0,
      },
      thisMonthMirs: {
        count: thisMonthMirs._count,
        total: thisMonthMirs._sum.totalAmount || 0,
      },
      recentExpenses,
      recentMirs,
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleUserBalances(searchParams: URLSearchParams, session: any) {
  if (!checkPermission(session.role, 'VIEW_ALL_EXPENSES')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const clientId = searchParams.get('clientId');
  const siteId = searchParams.get('siteId');
  const month = searchParams.get('month');
  const userId = searchParams.get('userId');

  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;
  if (month) {
    const [year, mon] = month.split('-').map(Number);
    dateFrom = new Date(year, mon - 1, 1);
    dateTo = new Date(year, mon, 0, 23, 59, 59);
  }

  const expenseWhere: Prisma.ExpenseWhereInput = {
    status: { in: ['ACCOUNTANT_APPROVED', 'ADMIN_APPROVED', 'PAID'] },
  };
  const advanceWhere: Prisma.AdvanceWhereInput = { status: 'PAID' };

  if (userId) { expenseWhere.userId = userId; advanceWhere.userId = userId; }
  if (clientId) { expenseWhere.site = { clientId }; advanceWhere.site = { clientId }; }
  if (siteId) { expenseWhere.siteId = siteId; advanceWhere.siteId = siteId; }
  if (dateFrom && dateTo) {
    expenseWhere.expenseDate = { gte: dateFrom, lte: dateTo };
    advanceWhere.createdAt = { gte: dateFrom, lte: dateTo };
  }

  const users = await db.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  });

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
}
