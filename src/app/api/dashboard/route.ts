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

    // Build advance where clause (mirrors frontend getAdvances logic)
    const advanceWhere: Prisma.AdvanceWhereInput = {
      status: { in: ['PENDING', 'PAID'] },
    };
    if (viewAsUserId && checkPermission(session.role, 'VIEW_ALL_EXPENSES')) {
      advanceWhere.userId = viewAsUserId;
    } else if (!checkPermission(session.role, 'VIEW_ALL_EXPENSES')) {
      advanceWhere.userId = session.id;
    }
    if (clientId) {
      advanceWhere.site = { clientId };
    }
    if (siteId) {
      advanceWhere.siteId = siteId;
    }

    // Expense stats: category breakdown for the filtered month
    const expenseStatsWhere: Prisma.ExpenseWhereInput = {
      ...thisMonthExpenseWhere,
    };

    // Late submissions: last 6 months
    const lateStartDate = new Date();
    lateStartDate.setMonth(lateStartDate.getMonth() - 6);
    lateStartDate.setDate(1);

    const lateWhere: Prisma.ExpenseWhereInput = {
      isLateSubmission: true,
      createdAt: { gte: lateStartDate },
    };
    if (viewAsUserId && checkPermission(session.role, 'VIEW_ALL_EXPENSES')) {
      lateWhere.userId = viewAsUserId;
    } else if (!checkPermission(session.role, 'VIEW_ALL_EXPENSES')) {
      lateWhere.userId = session.id;
    }
    if (clientId) lateWhere.site = { clientId };
    if (siteId) lateWhere.siteId = siteId;

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
      expensesByCategory,
      advancePaidAgg,
      advancePendingAgg,
      advancePendingTotalAgg,
      lateExpenses,
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
      // Expense stats: category breakdown
      db.expense.groupBy({
        by: ['categoryId'],
        where: expenseStatsWhere,
        _sum: { amount: true },
        _count: { id: true },
        orderBy: { _sum: { amount: 'desc' } },
      }),
      // Advance stats: total paid amount
      db.advance.aggregate({
        where: { ...advanceWhere, status: 'PAID' },
        _sum: { amount: true },
      }),
      // Advance stats: pending count
      db.advance.count({
        where: { ...advanceWhere, status: 'PENDING' },
      }),
      // Advance stats: pending total amount
      db.advance.aggregate({
        where: { ...advanceWhere, status: 'PENDING' },
        _sum: { amount: true },
      }),
      // Late submissions (last 6 months)
      db.expense.findMany({
        where: lateWhere,
        include: {
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Build category breakdown with names
    const categoryIds = expensesByCategory.map((e) => e.categoryId);
    const categories = categoryIds.length > 0
      ? await db.category.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
        })
      : [];
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
    const categoryBreakdown = expensesByCategory.map((item) => ({
      category: categoryMap.get(item.categoryId) || 'Unknown',
      total: item._sum.amount || 0,
      count: item._count.id,
    }));

    // Build late submissions monthly breakdown
    const monthlyLateData: Record<string, { count: number; totalAmount: number; totalDaysLate: number }> = {};
    for (const exp of lateExpenses) {
      const monthKey = exp.expenseDate.toISOString().slice(0, 7);
      if (!monthlyLateData[monthKey]) {
        monthlyLateData[monthKey] = { count: 0, totalAmount: 0, totalDaysLate: 0 };
      }
      monthlyLateData[monthKey].count++;
      monthlyLateData[monthKey].totalAmount += exp.amount;
      monthlyLateData[monthKey].totalDaysLate += exp.daysLate || 0;
    }

    const lateMonthlyBreakdown = Object.entries(monthlyLateData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        count: data.count,
        totalAmount: data.totalAmount,
        avgDaysLate: Math.round(data.totalDaysLate / data.count),
      }));

    // Per-user breakdown for top offenders
    const lateUserBreakdown: Record<string, { name: string; count: number; totalAmount: number; totalDaysLate: number }> = {};
    for (const exp of lateExpenses) {
      const uid = exp.userId;
      if (!lateUserBreakdown[uid]) {
        lateUserBreakdown[uid] = { name: exp.user?.name || 'Unknown', count: 0, totalAmount: 0, totalDaysLate: 0 };
      }
      lateUserBreakdown[uid].count++;
      lateUserBreakdown[uid].totalAmount += exp.amount;
      lateUserBreakdown[uid].totalDaysLate += exp.daysLate || 0;
    }

    const lateTopOffenders = Object.values(lateUserBreakdown)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

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
      // Combined expense stats (previously /api/dashboard/expense-stats)
      expenseStats: {
        categoryBreakdown,
        totalAmount: categoryBreakdown.reduce((sum, item) => sum + item.total, 0),
      },
      // Combined advance stats (previously fetched via /api/advances + client-side aggregation)
      advanceStats: {
        totalPaid: advancePaidAgg._sum.amount || 0,
        pendingCount: advancePendingAgg,
        pendingTotal: advancePendingTotalAgg._sum.amount || 0,
      },
      // Combined late submissions (previously /api/dashboard/late-submissions)
      lateSubmissions: {
        total: lateExpenses.length,
        totalAmount: lateExpenses.reduce((sum, e) => sum + e.amount, 0),
        monthlyBreakdown: lateMonthlyBreakdown,
        topOffenders: lateTopOffenders,
      },
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

  const balances = await Promise.all(
    targetUsers.map(async (user) => {
      const [expenseAgg, advanceAgg] = await Promise.all([
        db.expense.aggregate({
          where: { ...expenseWhere, userId: user.id },
          _sum: { amount: true },
          _count: true,
        }),
        db.advance.aggregate({
          where: { ...advanceWhere, userId: user.id },
          _sum: { amount: true },
          _count: true,
        }),
      ]);
      const totalExpenses = expenseAgg._sum.amount || 0;
      const totalAdvances = advanceAgg._sum.amount || 0;
      return {
        userId: user.id, name: user.name, email: user.email, role: user.role,
        totalAdvances, advanceCount: advanceAgg._count,
        totalExpenses, expenseCount: expenseAgg._count,
        balance: totalAdvances - totalExpenses,
      };
    })
  );

  return NextResponse.json({ balances });
}
