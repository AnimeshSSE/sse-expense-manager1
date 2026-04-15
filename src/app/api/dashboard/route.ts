import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Expense totals by status
    const expenseByStatus = await db.expense.groupBy({
      by: ["status"],
      _sum: { totalAmount: true },
      _count: true,
    });

    // Requisition totals by status
    const requisitionByStatus = await db.requisition.groupBy({
      by: ["status"],
      _sum: { totalAmount: true },
      _count: true,
    });

    // Advance totals by status
    const advanceByStatus = await db.advance.groupBy({
      by: ["status"],
      _sum: { amount: true },
      _count: true,
    });

    // Monthly expense trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyExpenses = await db.expense.findMany({
      where: {
        createdAt: { gte: sixMonthsAgo },
      },
      select: {
        totalAmount: true,
        status: true,
        createdAt: true,
      },
    });

    // Group by month
    const monthlyTrend: Record<string, { month: string; total: number; count: number }> = {};
    for (const expense of monthlyExpenses) {
      const key = expense.createdAt.toISOString().slice(0, 7); // YYYY-MM
      if (!monthlyTrend[key]) {
        monthlyTrend[key] = {
          month: key,
          total: 0,
          count: 0,
        };
      }
      monthlyTrend[key].total += expense.totalAmount;
      monthlyTrend[key].count += 1;
    }
    const monthlyExpenseTrend = Object.values(monthlyTrend).sort((a, b) =>
      a.month.localeCompare(b.month)
    );

    // Department breakdown
    const departmentBreakdown = await db.user.groupBy({
      by: ["department"],
      _count: { id: true },
      where: {
        department: { not: null },
        status: "ACTIVE",
      },
    });

    const expenseByDepartment = await db.expense.groupBy({
      by: ["department"],
      _sum: { totalAmount: true },
      _count: true,
      where: {
        department: { not: null },
      },
    });

    const departments = departmentBreakdown
      .map((d) => {
        const deptExpense = expenseByDepartment.find(
          (e) => e.department === d.department
        );
        return {
          department: d.department,
          userCount: d._count.id,
          totalExpenseAmount: deptExpense?._sum.totalAmount || 0,
          expenseCount: deptExpense?._count || 0,
        };
      })
      .sort((a, b) => (b.totalExpenseAmount || 0) - (a.totalExpenseAmount || 0));

    // Recent activity (last 10 items across all types)
    const recentExpenses = await db.expense.findMany({
      take: 5,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        totalAmount: true,
        updatedAt: true,
        user: { select: { name: true } },
      },
    });

    const recentRequisitions = await db.requisition.findMany({
      take: 5,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        totalAmount: true,
        updatedAt: true,
        user: { select: { name: true } },
      },
    });

    const recentAdvances = await db.advance.findMany({
      take: 5,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        amount: true,
        updatedAt: true,
        user: { select: { name: true } },
      },
    });

    // Merge and sort all recent activities
    const allActivity = [
      ...recentExpenses.map((e) => ({
        id: e.id,
        type: "EXPENSE" as const,
        title: e.title,
        status: e.status,
        amount: e.totalAmount,
        updatedAt: e.updatedAt,
        userName: e.user.name,
      })),
      ...recentRequisitions.map((r) => ({
        id: r.id,
        type: "REQUISITION" as const,
        title: r.title,
        status: r.status,
        amount: r.totalAmount,
        updatedAt: r.updatedAt,
        userName: r.user.name,
      })),
      ...recentAdvances.map((a) => ({
        id: a.id,
        type: "ADVANCE" as const,
        title: a.title,
        status: a.status,
        amount: a.amount,
        updatedAt: a.updatedAt,
        userName: a.user.name,
      })),
    ];

    allActivity.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    const recentActivity = allActivity.slice(0, 10);

    // Summary totals
    const totalExpenseAmount = expenseByStatus.reduce(
      (sum, e) => sum + (e._sum.totalAmount || 0),
      0
    );
    const totalRequisitionAmount = requisitionByStatus.reduce(
      (sum, r) => sum + (r._sum.totalAmount || 0),
      0
    );
    const totalAdvanceAmount = advanceByStatus.reduce(
      (sum, a) => sum + (a._sum.amount || 0),
      0
    );

    return NextResponse.json({
      summary: {
        totalExpenseAmount,
        totalRequisitionAmount,
        totalAdvanceAmount,
      },
      expenseByStatus,
      requisitionByStatus,
      advanceByStatus,
      monthlyExpenseTrend,
      departmentBreakdown: departments,
      recentActivity,
    });
  } catch (error) {
    console.error("GET dashboard error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
