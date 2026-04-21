import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const [
      totalEmployees,
      presentToday,
      onLeaveToday,
      monthSalaryTotal,
      pendingLeaves,
    ] = await Promise.all([
      // Total active employees
      db.employee.count({ where: { isActive: true } }),

      // Present today
      db.attendance.count({
        where: {
          date: { gte: today, lt: tomorrow },
          status: 'PRESENT',
        },
      }),

      // On leave today (approved leaves that include today)
      db.leave.count({
        where: {
          status: 'APPROVED',
          startDate: { lte: today },
          endDate: { gte: today },
        },
      }),

      // This month's salary total (paid)
      db.salary.aggregate({
        where: { month: currentMonth, status: 'PAID' },
        _sum: { netSalary: true },
      }),

      // Pending leaves
      db.leave.count({
        where: { status: 'PENDING' },
      }),
    ]);

    return NextResponse.json({
      totalEmployees,
      presentToday,
      onLeaveToday,
      monthSalaryPaidTotal: monthSalaryTotal._sum.netSalary || 0,
      pendingLeaves,
    });
  } catch (error: any) {
    console.error('Get HR stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
