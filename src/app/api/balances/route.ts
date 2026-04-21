import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (!checkPermission(session.role, 'VIEW_ALL_EXPENSES')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
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

    const expenseWhere: Prisma.ExpenseWhereInput = { status: { in: ['ACCOUNTANT_APPROVED', 'ADMIN_APPROVED', 'PAID'] } };
    const advanceWhere: Prisma.AdvanceWhereInput = { status: 'PAID' };

    if (userId) { expenseWhere.userId = userId; advanceWhere.userId = userId; }
    if (clientId) { expenseWhere.site = { clientId }; advanceWhere.site = { clientId }; }
    if (siteId) { expenseWhere.siteId = siteId; advanceWhere.siteId = siteId; }
    if (dateFrom && dateTo) { expenseWhere.expenseDate = { gte: dateFrom, lte: dateTo }; advanceWhere.createdAt = { gte: dateFrom, lte: dateTo }; }

    const users = await db.user.findMany({ where: { isActive: true }, select: { id: true, name: true, email: true, role: true }, orderBy: { name: 'asc' } });
    const targetUsers = userId ? users.filter((u) => u.id === userId) : users;

    const balances = await Promise.all(targetUsers.map(async (user) => {
      const [expenseAgg, advanceAgg] = await Promise.all([
        db.expense.aggregate({ where: { ...expenseWhere, userId: user.id }, _sum: { amount: true }, _count: true }),
        db.advance.aggregate({ where: { ...advanceWhere, userId: user.id }, _sum: { amount: true }, _count: true }),
      ]);
      const totalExpenses = expenseAgg._sum.amount || 0;
      const totalAdvances = advanceAgg._sum.amount || 0;
      return { userId: user.id, name: user.name, email: user.email, role: user.role, totalAdvances, advanceCount: advanceAgg._count, totalExpenses, expenseCount: expenseAgg._count, balance: totalAdvances - totalExpenses };
    }));

    return NextResponse.json({ balances });
  } catch (error: any) {
    console.error('Balances error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
