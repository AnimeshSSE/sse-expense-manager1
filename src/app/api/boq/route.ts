import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { Prisma } from '@prisma/client'

// GET /api/boq
export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sp = req.nextUrl.searchParams
    const search = sp.get('search') || ''
    const requisitionId = sp.get('requisitionId') || ''
    const category = sp.get('category') || ''
    const priceFrom = sp.get('priceFrom') || ''
    const priceTo = sp.get('priceTo') || ''
    const page = Math.max(1, parseInt(sp.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '20')))
    const sortBy = sp.get('sortBy') || 'createdAt'
    const sortOrder = sp.get('sortOrder') || 'desc'

    const allowedSortFields = ['createdAt', 'updatedAt', 'itemName', 'quantity', 'unitPrice', 'totalPrice', 'category']
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt'
    const sortDir = sortOrder === 'asc' ? 'asc' : 'desc'

    const where: Prisma.BOQItemWhereInput = {}

    if (search) {
      where.OR = [
        { itemName: { contains: search } },
        { description: { contains: search } },
        { category: { contains: search } },
      ]
    }

    if (requisitionId) where.requisitionId = requisitionId
    if (category) where.category = category

    if (priceFrom || priceTo) {
      where.totalPrice = {}
      if (priceFrom) where.totalPrice.gte = parseFloat(priceFrom)
      if (priceTo) where.totalPrice.lte = parseFloat(priceTo)
    }

    // Non-admin/stock-manager users can only see their own requisitions' BOQ items
    if (!checkPermission(session.role, 'VIEW_ALL_MIRS')) {
      where.requisition = { userId: session.id }
    }

    const [boqItems, total] = await Promise.all([
      db.bOQItem.findMany({
        where,
        include: {
          requisition: {
            include: {
              site: { include: { client: true } },
              user: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { [sortField]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.bOQItem.count({ where }),
    ])

    return NextResponse.json({
      data: boqItems,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error: any) {
    console.error('GET /api/boq error:', error)
    return NextResponse.json({ error: 'Failed to fetch BOQ items' }, { status: 500 })
  }
}
