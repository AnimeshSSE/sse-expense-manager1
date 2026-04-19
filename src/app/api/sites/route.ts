import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'

// GET /api/sites — list with client name + totalSpent using GROUP BY
export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!checkPermission(session.role, 'MANAGE_SITES')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const sp = req.nextUrl.searchParams
    const search = sp.get('search') || ''
    const clientId = sp.get('clientId') || ''
    const isActive = sp.get('isActive')
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '20', 10) || 20))

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { location: { contains: search } },
        { client: { name: { contains: search } } },
      ]
    }

    if (clientId) {
      where.clientId = clientId
    }

    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true'
    }

    const [data, total, expenseBySite, reqBySite, advBySite] = await Promise.all([
      db.site.findMany({
        where,
        include: {
          client: { select: { id: true, name: true } },
          _count: { select: { expenses: true, requisitions: true, advances: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.site.count({ where }),
      db.expense.groupBy({ by: ['siteId'], _sum: { amount: true } }),
      db.requisition.groupBy({ by: ['siteId'], _sum: { totalAmount: true } }),
      db.advance.groupBy({ by: ['siteId'], _sum: { amount: true } }),
    ])

    // Build lookup maps from GROUP BY results
    const expenseMap = new Map(expenseBySite.map(e => [e.siteId, e._sum.amount || 0]))
    const reqMap = new Map(reqBySite.map(e => [e.siteId, e._sum.totalAmount || 0]))
    const advMap = new Map(advBySite.map(e => [e.siteId, e._sum.amount || 0]))

    // Attach totalSpent to each site
    const enrichedData = data.map(site => {
      const expenseSpent = expenseMap.get(site.id) || 0
      const reqSpent = reqMap.get(site.id) || 0
      const advSpent = advMap.get(site.id) || 0
      const totalSpent = expenseSpent + reqSpent + advSpent
      return {
        ...site,
        totalSpent,
        remaining: site.budget - totalSpent,
      }
    })

    return NextResponse.json({
      data: enrichedData,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('GET /api/sites error:', error)
    return NextResponse.json({ error: 'Failed to fetch sites' }, { status: 500 })
  }
}

// POST /api/sites — create
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!checkPermission(session.role, 'MANAGE_SITES')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { name, clientId, location, description, budget, isActive } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Site name is required' }, { status: 400 })
    }

    if (!clientId) {
      return NextResponse.json({ error: 'Client is required' }, { status: 400 })
    }

    // Validate client exists and is active
    const client = await db.client.findUnique({ where: { id: clientId } })
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const site = await db.site.create({
      data: {
        name: name.trim(),
        clientId,
        location: location || null,
        description: description || null,
        budget: typeof budget === 'number' ? budget : 0,
        isActive: isActive !== undefined ? isActive : true,
      },
      include: {
        client: { select: { id: true, name: true } },
      },
    })

    await createAuditLog({
      userId: session.id,
      action: 'CREATE_SITE',
      entityType: 'SITE',
      entityId: site.id,
      newValues: JSON.stringify(site),
    })

    return NextResponse.json({ data: site }, { status: 201 })
  } catch (error) {
    console.error('POST /api/sites error:', error)
    return NextResponse.json({ error: 'Failed to create site' }, { status: 500 })
  }
}
