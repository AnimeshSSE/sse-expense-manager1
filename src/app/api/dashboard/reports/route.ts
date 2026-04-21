import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';

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

    // Get expense stats by category and by month
    const [byCategory, bySite, totalAmount] = await Promise.all([
      db.expense.groupBy({
        by: ['categoryId'],
        where,
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
      }),
      db.expense.groupBy({
        by: ['siteId'],
        where,
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
      }),
      db.expense.aggregate({ where, _sum: { amount: true }, _count: true }),
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

    return NextResponse.json({
      period,
      startDate: startDate.toISOString(),
      totalAmount: totalAmount._sum.amount || 0,
      totalCount: totalAmount._count,
      byCategory: byCategory.map((c) => ({
        categoryId: c.categoryId,
        categoryName: catMap[c.categoryId] || 'Unknown',
        total: c._sum.amount || 0,
        count: c._count,
      })),
      bySite: bySite.map((s) => ({
        siteId: s.siteId,
        siteName: siteMap[s.siteId] || 'Unknown',
        total: s._sum.amount || 0,
        count: s._count,
      })),
    });
  } catch (error: any) {
    console.error('Reports error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
