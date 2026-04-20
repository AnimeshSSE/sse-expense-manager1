import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const paramClientId = searchParams.get('clientId')
    const paramSiteId = searchParams.get('siteId')
    const paramMonth = searchParams.get('month') // YYYY-MM

    const canViewAllExpenses = checkPermission(session.role, 'VIEW_ALL_EXPENSES')
    const canViewAllMirs = checkPermission(session.role, 'VIEW_ALL_MIRS')
    const canViewAllAdvances = checkPermission(session.role, 'VIEW_ALL_ADVANCES')
    const canViewReports = checkPermission(session.role, 'VIEW_REPORTS')

    // Build base WHERE clauses
    const userWhere = (!canViewAllExpenses) ? { userId: session.id } : {}
    const mirUserWhere = (!canViewAllMirs) ? { userId: session.id } : {}
    const advanceUserWhere = (!canViewAllAdvances) ? { userId: session.id } : {}

    // Date range for "this month"
    const now = new Date()
    const monthToUse = paramMonth
      ? new Date(paramMonth + '-01')
      : new Date(now.getFullYear(), now.getMonth(), 1)
    const monthStart = new Date(monthToUse.getFullYear(), monthToUse.getMonth(), 1)
    const monthEnd = new Date(monthToUse.getFullYear(), monthToUse.getMonth() + 1, 1)

    // Client/Site filters
    const clientFilter = paramClientId ? { clientId: paramClientId } : {}
    const siteFilter = paramSiteId ? { siteId: paramSiteId } : {}

    // Combined expense where
    const expenseBaseWhere: Prisma.ExpenseWhereInput = {
      ...userWhere,
      ...siteFilter,
      ...(paramClientId ? { site: { clientId: paramClientId } } : {}),
    }

    const mirBaseWhere: Prisma.RequisitionWhereInput = {
      ...mirUserWhere,
      ...siteFilter,
      ...(paramClientId ? { site: { clientId: paramClientId } } : {}),
    }

    const advanceBaseWhere: Prisma.AdvanceWhereInput = {
      ...advanceUserWhere,
      ...siteFilter,
      ...(paramClientId ? { site: { clientId: paramClientId } } : {}),
    }

    const { Prisma: P } = await import('@prisma/client')

    // ===== RUN ALL QUERIES IN PARALLEL =====
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
      lateSubmissions,
      lateSubmissionsMonthly,
      expenseByUser,
      advanceByUser,
      allUsers,
      reportsByCategory,
      reportsBySite,
      reportsByMonthRaw,
      allExpenseCount,
    ] = await Promise.all([
      // Stats: This month expenses
      db.expense.aggregate({
        where: { ...expenseBaseWhere, expenseDate: { gte: monthStart, lt: monthEnd } },
        _sum: { amount: true },
        _count: true,
      }),

      // Stats: Pending expenses
      db.expense.aggregate({
        where: { ...expenseBaseWhere, status: 'PENDING' },
        _sum: { amount: true },
        _count: true,
      }),

      // Stats: Accountant approved
      db.expense.aggregate({
        where: { ...expenseBaseWhere, status: 'ACCOUNTANT_APPROVED' },
        _sum: { amount: true },
        _count: true,
      }),

      // Stats: Admin approved
      db.expense.aggregate({
        where: { ...expenseBaseWhere, status: 'ADMIN_APPROVED' },
        _sum: { amount: true },
        _count: true,
      }),

      // Stats: Paid expenses
      db.expense.aggregate({
        where: { ...expenseBaseWhere, status: 'PAID' },
        _sum: { amount: true },
        _count: true,
      }),

      // Stats: Pending MIRs
      db.requisition.aggregate({
        where: { ...mirBaseWhere, status: 'PENDING' },
        _sum: { totalAmount: true },
        _count: true,
      }),

      // Stats: Stock Manager approved MIRs
      db.requisition.aggregate({
        where: { ...mirBaseWhere, status: 'STOCK_MANAGER_APPROVED' },
        _sum: { totalAmount: true },
        _count: true,
      }),

      // Stats: Admin approved MIRs
      db.requisition.aggregate({
        where: { ...mirBaseWhere, status: 'ADMIN_APPROVED' },
        _sum: { totalAmount: true },
        _count: true,
      }),

      // Stats: This month MIRs
      db.requisition.aggregate({
        where: { ...mirBaseWhere, createdAt: { gte: monthStart, lt: monthEnd } },
        _sum: { totalAmount: true },
        _count: true,
      }),

      // Recent expenses (last 5)
      db.expense.findMany({
        where: expenseBaseWhere,
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          site: { include: { client: { select: { name: true } } } },
          category: { select: { name: true } },
          user: { select: { name: true } },
        },
      }),

      // Recent MIRs (last 5)
      db.requisition.findMany({
        where: mirBaseWhere,
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          site: { include: { client: { select: { name: true } } } },
          user: { select: { name: true } },
        },
      }),

      // Late submissions
      db.expense.findMany({
        where: { ...expenseBaseWhere, isLateSubmission: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: {
          user: { select: { name: true, email: true } },
          site: { select: { name: true } },
        },
      }),

      // Late submissions monthly breakdown (GROUP BY)
      db.$queryRaw<Array<{ month: string; total: number; count: number }>>(
        P.sql`
          SELECT 
            strftime('%Y-%m', e."createdAt") as month,
            COALESCE(SUM(e."amount"), 0) as total,
            COUNT(*) as count
          FROM "Expense" e
          WHERE e."isLateSubmission" = 1
          GROUP BY strftime('%Y-%m', e."createdAt")
          ORDER BY month DESC
          LIMIT 12
        `
      ),

      // User balances: Expenses GROUP BY userId
      db.expense.groupBy({
        by: ['userId'],
        where: { status: { in: ['PENDING', 'ACCOUNTANT_APPROVED', 'ADMIN_APPROVED', 'PAID'] }, ...userWhere, ...siteFilter, ...(paramClientId ? { site: { clientId: paramClientId } } : {}) },
        _sum: { amount: true },
        _count: true,
      }),

      // User balances: Advances GROUP BY userId
      db.advance.groupBy({
        by: ['userId'],
        where: { status: { in: ['APPROVED', 'PAID'] }, ...advanceUserWhere, ...siteFilter, ...(paramClientId ? { site: { clientId: paramClientId } } : {}) },
        _sum: { amount: true },
        _count: true,
      }),

      // All users (for merging)
      db.user.findMany({
        select: { id: true, name: true, email: true, role: true },
        where: { isActive: true },
      }),

      // Reports: By category
      canViewReports
        ? db.expense.groupBy({
            by: ['categoryId'],
            where: expenseBaseWhere,
            _sum: { amount: true },
            _count: true,
          })
        : Promise.resolve([]),

      // Reports: By site
      canViewReports
        ? db.expense.groupBy({
            by: ['siteId'],
            where: expenseBaseWhere,
            _sum: { amount: true },
            _count: true,
          })
        : Promise.resolve([]),

      // Reports: By month — raw SQL with tagged template
      canViewReports
        ? db.$queryRaw<Array<{ month: string; total: number; count: number }>>(
            P.sql`
              SELECT 
                strftime('%Y-%m', e."expenseDate") as month,
                COALESCE(SUM(e."amount"), 0) as total,
                COUNT(*) as count
              FROM "Expense" e
              WHERE 1=1
                ${(!canViewAllExpenses) ? P.sql`AND e."userId" = ${session.id}` : P.empty}
                ${paramSiteId ? P.sql`AND e."siteId" = ${paramSiteId}` : P.empty}
              GROUP BY strftime('%Y-%m', e."expenseDate")
              ORDER BY month DESC
              LIMIT 12
            `
          )
        : Promise.resolve([]),

      // Total count for reports
      canViewReports
        ? db.expense.count({ where: expenseBaseWhere })
        : Promise.resolve(0),
    ])

    // ===== BUILD LATE SUBMISSIONS DERIVED DATA =====
    const lateTotal = lateSubmissions.length
    const lateTotalAmount = lateSubmissions.reduce((sum, e) => sum + e.amount, 0)

    // Top offenders: group by userId
    const offenderMap = new Map<string, { userId: string; userName: string; count: number; totalAmount: number }>()
    for (const exp of lateSubmissions) {
      const existing = offenderMap.get(exp.userId)
      if (existing) {
        existing.count++
        existing.totalAmount += exp.amount
      } else {
        offenderMap.set(exp.userId, {
          userId: exp.userId,
          userName: exp.user.name,
          count: 1,
          totalAmount: exp.amount,
        })
      }
    }
    const topOffenders = Array.from(offenderMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const lateRecent = lateSubmissions.slice(0, 10).map(e => ({
      id: e.id,
      amount: e.amount,
      description: e.description,
      daysLate: e.daysLate,
      userName: e.user.name,
      siteName: e.site.name,
      createdAt: e.createdAt,
    }))

    // ===== BUILD USER BALANCES =====
    const userMap = new Map(allUsers.map(u => [u.id, u]))
    const balanceMap = new Map<string, { totalExpenses: number; expenseCount: number; totalAdvances: number; advanceCount: number }>()

    for (const row of expenseByUser) {
      balanceMap.set(row.userId, {
        totalExpenses: row._sum.amount || 0,
        expenseCount: row._count,
        totalAdvances: 0,
        advanceCount: 0,
      })
    }

    for (const row of advanceByUser) {
      const existing = balanceMap.get(row.userId) || {
        totalExpenses: 0,
        expenseCount: 0,
        totalAdvances: 0,
        advanceCount: 0,
      }
      existing.totalAdvances = row._sum.amount || 0
      existing.advanceCount = row._count
      balanceMap.set(row.userId, existing)
    }

    const userBalances = Array.from(balanceMap.entries()).map(([userId, data]) => {
      const u = userMap.get(userId)
      return {
        userId,
        userName: u?.name || 'Unknown',
        userEmail: u?.email || '',
        userRole: u?.role || '',
        totalExpenses: data.totalExpenses,
        expenseCount: data.expenseCount,
        totalAdvances: data.totalAdvances,
        advanceCount: data.advanceCount,
        balance: data.totalAdvances - data.totalExpenses,
      }
    }).sort((a, b) => a.balance - b.balance)

    // ===== BUILD REPORTS DATA =====
    // Category names lookup
    const categoryIds = reportsByCategory.map(r => r.categoryId)
    const categories = categoryIds.length > 0
      ? await db.category.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
        })
      : []
    const catMap = new Map(categories.map(c => [c.id, c.name]))

    const reportsByCategoryData = reportsByCategory.map(r => ({
      categoryId: r.categoryId,
      categoryName: catMap.get(r.categoryId) || 'Unknown',
      total: r._sum.amount || 0,
      count: r._count,
    })).sort((a, b) => b.total - a.total)

    // Site names lookup
    const siteIds = reportsBySite.map(r => r.siteId)
    const sites = siteIds.length > 0
      ? await db.site.findMany({
          where: { id: { in: siteIds } },
          select: { id: true, name: true },
        })
      : []
    const siteMap = new Map(sites.map(s => [s.id, s.name]))

    const reportsBySiteData = reportsBySite.map(r => ({
      siteId: r.siteId,
      siteName: siteMap.get(r.siteId) || 'Unknown',
      total: r._sum.amount || 0,
      count: r._count,
    })).sort((a, b) => b.total - a.total)

    const reportsByMonthData = reportsByMonthRaw.map(r => ({
      month: r.month,
      total: r.total,
      count: r.count,
    })).sort((a, b) => a.month.localeCompare(b.month))

    const totalAmount = reportsByCategory.reduce((sum, r) => sum + (r._sum.amount || 0), 0)

    // ===== COMPOSE FINAL RESPONSE =====
    return NextResponse.json({
      stats: {
        thisMonthExpenses: { total: thisMonthExpenses._sum.amount || 0, count: thisMonthExpenses._count },
        pendingExpenses: { count: pendingExpenses._count, total: pendingExpenses._sum.amount || 0 },
        accountantApprovedExpenses: { count: accountantApprovedExpenses._count, total: accountantApprovedExpenses._sum.amount || 0 },
        adminApprovedExpenses: { count: adminApprovedExpenses._count, total: adminApprovedExpenses._sum.amount || 0 },
        paidExpenses: { count: paidExpenses._count, total: paidExpenses._sum.amount || 0 },
        pendingMirs: { count: pendingMirs._count, total: pendingMirs._sum.totalAmount || 0 },
        stockMgrApprovedMirs: { count: stockMgrApprovedMirs._count, total: stockMgrApprovedMirs._sum.totalAmount || 0 },
        adminApprovedMirs: { count: adminApprovedMirs._count, total: adminApprovedMirs._sum.totalAmount || 0 },
        thisMonthMirs: { count: thisMonthMirs._count, total: thisMonthMirs._sum.totalAmount || 0 },
      },
      recentExpenses: recentExpenses.map(e => ({
        id: e.id,
        amount: e.amount,
        description: e.description,
        expenseDate: e.expenseDate,
        status: e.status,
        siteName: e.site.name,
        clientName: e.site.client.name,
        categoryName: e.category.name,
        userName: e.user.name,
      })),
      recentMirs: recentMirs.map(m => ({
        id: m.id,
        title: m.title,
        totalAmount: m.totalAmount,
        priority: m.priority,
        status: m.status,
        createdAt: m.createdAt,
        siteName: m.site.name,
        clientName: m.site.client.name,
        userName: m.user.name,
      })),
      lateSubmissions: {
        total: lateTotal,
        totalAmount: lateTotalAmount,
        monthlyBreakdown: lateSubmissionsMonthly,
        topOffenders,
        recent: lateRecent,
      },
      userBalances,
      reports: canViewReports ? {
        byCategory: reportsByCategoryData,
        byMonth: reportsByMonthData,
        bySite: reportsBySiteData,
        totalAmount,
        totalCount: allExpenseCount,
      } : { byCategory: [], byMonth: [], bySite: [], totalAmount: 0, totalCount: 0 },
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 })
  }
}
