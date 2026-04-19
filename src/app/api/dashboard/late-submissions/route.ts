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
    const months = parseInt(searchParams.get('months') || '6');

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    startDate.setDate(1);

    // Build where clause
    const where: Prisma.ExpenseWhereInput = {
      isLateSubmission: true,
      createdAt: { gte: startDate },
    };

    if (!checkPermission(session.role, 'VIEW_ALL_EXPENSES')) {
      where.userId = session.id;
    }

    const lateExpenses = await db.expense.findMany({
      where,
      include: {
        site: { include: { client: { select: { id: true, name: true } } } },
        category: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // Group by month
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
      const userId = exp.userId;
      if (!userBreakdown[userId]) {
        userBreakdown[userId] = { name: exp.user?.name || 'Unknown', count: 0, totalAmount: 0, totalDaysLate: 0 };
      }
      userBreakdown[userId].count++;
      userBreakdown[userId].totalAmount += exp.amount;
      userBreakdown[userId].totalDaysLate += exp.daysLate || 0;
    }

    const topOffenders = Object.values(userBreakdown)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return NextResponse.json({
      total: lateExpenses.length,
      totalAmount: lateExpenses.reduce((sum, e) => sum + e.amount, 0),
      monthlyBreakdown,
      topOffenders,
      recent: lateExpenses.slice(0, 20),
    });
  } catch (error: any) {
    console.error('Late submissions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
