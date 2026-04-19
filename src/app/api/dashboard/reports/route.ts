import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'monthly';
    const clientId = searchParams.get('clientId');
    const siteId = searchParams.get('siteId');
    const userId = searchParams.get('userId');

    // Determine date range
    const now = new Date();
    const months = period === 'quarterly' ? 12 : 6;
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    const where: Prisma.ExpenseWhereInput = {
      expenseDate: { gte: startDate },
      status: { not: 'REJECTED' },
    };
    if (clientId) where.site = { clientId };
    if (siteId) where.siteId = siteId;
    if (userId) where.userId = userId;

    // Build the raw SQL conditions safely
    // Prisma stores DateTime as BigInt (Unix ms). Use unixepoch modifier.
    const startMs = startDate.getTime();
    const conditions: string[] = [
      `expenseDate >= ${startMs}`,
      `status != 'REJECTED'`,
    ];
    if (siteId) conditions.push(`siteId = '${siteId.replace(/'/g, "''")}'`);
    if (userId) conditions.push(`userId = '${userId.replace(/'/g, "''")}'`);
    if (clientId) conditions.push(`siteId IN (SELECT id FROM "Site" WHERE clientId = '${clientId.replace(/'/g, "''")}')`);

    const whereClause = conditions.join(' AND ');
    const sqlQuery = `
      SELECT strftime('%Y-%m', date(expenseDate / 1000, 'unixepoch', 'localtime')) as month, 
             SUM(amount) as total, COUNT(*) as count
      FROM "Expense" 
      WHERE ${whereClause}
      GROUP BY strftime('%Y-%m', date(expenseDate / 1000, 'unixepoch', 'localtime'))
      ORDER BY month DESC
    `;

    // Get expense stats by category and by month
    const [byCategory, byMonth, bySite, totalAmount, totalCount] = await Promise.all([
      db.expense.groupBy({
        by: ['categoryId'],
        where,
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
      }),
      db.$queryRawUnsafe<Array<{ month: string; total: number; count: number }>>(sqlQuery),
      db.expense.groupBy({
        by: ['siteId'],
        where,
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
      }),
      db.expense.aggregate({ where, _sum: { amount: true }, _count: true }),
      db.expense.count({ where }),
    ]);

    // Get category names
    const categoryIds = byCategory.map((c) => c.categoryId);
    const categories = categoryIds.length > 0
      ? await db.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } })
      : [];
    const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

    // Get site names
    const siteIds = bySite.map((s) => s.siteId);
    const sitesData = siteIds.length > 0
      ? await db.site.findMany({ where: { id: { in: siteIds } }, select: { id: true, name: true } })
      : [];
    const siteMap = Object.fromEntries(sitesData.map((s) => [s.id, s.name]));

    // Fetch late submissions data (combined from /api/dashboard/late-submissions)
    const lateStartDate = new Date();
    lateStartDate.setMonth(lateStartDate.getMonth() - 6);
    lateStartDate.setDate(1);

    const lateWhere: Prisma.ExpenseWhereInput = {
      isLateSubmission: true,
      createdAt: { gte: lateStartDate },
    };
    if (!checkPermission(session.role, 'VIEW_ALL_EXPENSES')) {
      lateWhere.userId = session.id;
    }
    if (clientId) lateWhere.site = { clientId };
    if (siteId) lateWhere.siteId = siteId;
    if (userId) lateWhere.userId = userId;

    const lateExpenses = await db.expense.findMany({
      where: lateWhere,
      include: {
        site: { include: { client: { select: { id: true, name: true } } } },
        category: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group late submissions by month
    const monthlyData: Record<string, { count: number; totalAmount: number; totalDaysLate: number }> = {};
    for (const exp of lateExpenses) {
      const monthKey = exp.expenseDate.toISOString().slice(0, 7);
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { count: 0, totalAmount: 0, totalDaysLate: 0 };
      }
      monthlyData[monthKey].count++;
      monthlyData[monthKey].totalAmount += exp.amount;
      monthlyData[monthKey].totalDaysLate += exp.daysLate || 0;
    }

    const monthlyBreakdown = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        count: data.count,
        totalAmount: data.totalAmount,
        avgDaysLate: Math.round(data.totalDaysLate / data.count),
      }));

    // Per-user breakdown
    const userBreakdown: Record<string, { name: string; count: number; totalAmount: number; totalDaysLate: number }> = {};
    for (const exp of lateExpenses) {
      const uid = exp.userId;
      if (!userBreakdown[uid]) {
        userBreakdown[uid] = { name: exp.user?.name || 'Unknown', count: 0, totalAmount: 0, totalDaysLate: 0 };
      }
      userBreakdown[uid].count++;
      userBreakdown[uid].totalAmount += exp.amount;
      userBreakdown[uid].totalDaysLate += exp.daysLate || 0;
    }

    const topOffenders = Object.values(userBreakdown)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const lateSubmissions = {
      total: lateExpenses.length,
      totalAmount: lateExpenses.reduce((sum, e) => sum + e.amount, 0),
      monthlyBreakdown,
      topOffenders,
    };

    return NextResponse.json({
      period,
      startDate: startDate.toISOString(),
      totalAmount: totalAmount._sum.amount || 0,
      totalCount,
      byCategory: byCategory.map((c) => ({
        categoryId: c.categoryId,
        categoryName: catMap[c.categoryId] || 'Unknown',
        total: c._sum.amount || 0,
        count: c._count,
      })),
      byMonth: byMonth.map((m) => ({
        month: m.month,
        total: Number(m.total) || 0,
        count: Number(m.count) || 0,
      })),
      bySite: bySite.map((s) => ({
        siteId: s.siteId,
        siteName: siteMap[s.siteId] || 'Unknown',
        total: s._sum.amount || 0,
        count: s._count,
      })),
      // Combined late submissions (previously /api/dashboard/late-submissions)
      lateSubmissions,
    });
  } catch (error: any) {
    console.error('Reports error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
