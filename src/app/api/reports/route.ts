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

    if (!checkPermission(session.role, 'VIEW_REPORTS')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'monthly'
    const paramClientId = searchParams.get('clientId')
    const paramSiteId = searchParams.get('siteId')
    const paramUserId = searchParams.get('userId')

    // Calculate date range based on period
    const now = new Date()
    let dateStart: Date
    let dateEnd: Date

    if (period === 'quarterly') {
      const quarter = Math.floor(now.getMonth() / 3)
      dateStart = new Date(now.getFullYear(), quarter * 3, 1)
      dateEnd = new Date(now.getFullYear(), quarter * 3 + 3, 1)
    } else {
      // monthly: last 12 months
      dateStart = new Date(now.getFullYear(), now.getMonth() - 11, 1)
      dateEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    }

    // Build base WHERE clauses
    const userWhere = paramUserId ? { userId: paramUserId } : {}
    const siteFilter = paramSiteId ? { siteId: paramSiteId } : {}
    const clientFilter = paramClientId ? { site: { clientId: paramClientId } } : {}

    const expenseWhere: Prisma.ExpenseWhereInput = {
      expenseDate: { gte: dateStart, lt: dateEnd },
      ...userWhere,
      ...siteFilter,
      ...clientFilter,
    }

    const { Prisma: P } = await import('@prisma/client')

    // Run all queries in parallel
    const [
      byCategory,
      bySiteRaw,
      byMonthRaw,
      totalAggregate,
    ] = await Promise.all([
      // By category
      db.expense.groupBy({
        by: ['categoryId'],
        where: expenseWhere,
        _sum: { amount: true },
        _count: true,
      }),

      // By site
      db.expense.groupBy({
        by: ['siteId'],
        where: expenseWhere,
        _sum: { amount: true },
        _count: true,
      }),

      // By month — raw SQL with tagged template (NOT $queryRawUnsafe)
      db.$queryRaw<Array<{ month: string; total: number; count: number }>>(
        P.sql`
          SELECT 
            strftime('%Y-%m', e."expenseDate") as month,
            COALESCE(SUM(e."amount"), 0) as total,
            COUNT(*) as count
          FROM "Expense" e
          WHERE e."expenseDate" >= ${dateStart.toISOString()} 
            AND e."expenseDate" < ${dateEnd.toISOString()}
            ${paramSiteId ? P.sql`AND e."siteId" = ${paramSiteId}` : P.empty}
            ${paramUserId ? P.sql`AND e."userId" = ${paramUserId}` : P.empty}
          GROUP BY strftime('%Y-%m', e."expenseDate")
          ORDER BY month ASC
        `
      ),

      // Total aggregate
      db.expense.aggregate({
        where: expenseWhere,
        _sum: { amount: true },
        _count: true,
      }),
    ])

    // Category name lookup
    const categoryIds = byCategory.map(r => r.categoryId)
    const categories = categoryIds.length > 0
      ? await db.category.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
        })
      : []
    const catMap = new Map(categories.map(c => [c.id, c.name]))

    const byCategoryData = byCategory.map(r => ({
      categoryId: r.categoryId,
      categoryName: catMap.get(r.categoryId) || 'Unknown',
      total: r._sum.amount || 0,
      count: r._count,
    })).sort((a, b) => b.total - a.total)

    // Site name lookup
    const siteIds = bySiteRaw.map(r => r.siteId)
    const sites = siteIds.length > 0
      ? await db.site.findMany({
          where: { id: { in: siteIds } },
          select: { id: true, name: true },
        })
      : []
    const siteMap = new Map(sites.map(s => [s.id, s.name]))

    const bySiteData = bySiteRaw.map(r => ({
      siteId: r.siteId,
      siteName: siteMap.get(r.siteId) || 'Unknown',
      clientName: '',
      total: r._sum.amount || 0,
      count: r._count,
    })).sort((a, b) => b.total - a.total)

    const byMonthData = byMonthRaw.map(r => ({
      month: r.month,
      total: r.total,
      count: r.count,
    }))

    return NextResponse.json({
      byCategory: byCategoryData,
      byMonth: byMonthData,
      bySite: bySiteData,
      totalAmount: totalAggregate._sum.amount || 0,
      totalCount: totalAggregate._count,
      period,
      dateRange: { start: dateStart.toISOString(), end: dateEnd.toISOString() },
    })
  } catch (error) {
    console.error('Reports API error:', error)
    return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 })
  }
}
