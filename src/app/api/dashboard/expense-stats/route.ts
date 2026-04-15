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
    const clientId = searchParams.get('clientId');
    const siteId = searchParams.get('siteId');
    const month = searchParams.get('month');
    const viewAsUserId = searchParams.get('userId');

    // Parse month to date range
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined;
    if (month) {
      const [year, mon] = month.split('-').map(Number);
      dateFrom = new Date(year, mon - 1, 1);
      dateTo = new Date(year, mon, 0, 23, 59, 59);
    }

    // Build where clause
    const where: Prisma.ExpenseWhereInput = {};

    if (viewAsUserId && checkPermission(session.role, 'VIEW_ALL_EXPENSES')) {
      where.userId = viewAsUserId;
    } else if (!checkPermission(session.role, 'VIEW_ALL_EXPENSES')) {
      where.userId = session.id;
    }

    if (clientId) {
      where.site = { clientId };
    }
    if (siteId) {
      where.siteId = siteId;
    }
    if (dateFrom && dateTo) {
      where.expenseDate = { gte: dateFrom, lte: dateTo };
    }

    // Group expenses by category
    const expensesByCategory = await db.expense.groupBy({
      by: ['categoryId'],
      where,
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
    });

    // Fetch category names
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

    return NextResponse.json({
      categoryBreakdown,
      totalAmount: categoryBreakdown.reduce((sum, item) => sum + item.total, 0),
    });
  } catch (error: any) {
    console.error('Expense stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
