import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'
import type { Prisma } from '@prisma/client'

// GET /api/requisitions
export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sp = req.nextUrl.searchParams
    const search = sp.get('search') || ''
    const status = sp.get('status') || ''
    const siteId = sp.get('siteId') || ''
    const clientId = sp.get('clientId') || ''
    const userId = sp.get('userId') || ''
    const priority = sp.get('priority') || ''
    const dateFrom = sp.get('dateFrom') || ''
    const dateTo = sp.get('dateTo') || ''
    const page = Math.max(1, parseInt(sp.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '20')))
    const sortBy = sp.get('sortBy') || 'createdAt'
    const sortOrder = sp.get('sortOrder') || 'desc'

    const allowedSortFields = ['createdAt', 'updatedAt', 'title', 'status', 'priority', 'requiredDate', 'totalAmount']
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt'
    const sortDir = sortOrder === 'asc' ? 'asc' : 'desc'

    const where: Prisma.RequisitionWhereInput = {}

    // Non-admin users only see their own requisitions unless they have VIEW_ALL_MIRS
    if (!checkPermission(session.role, 'VIEW_ALL_MIRS')) {
      where.userId = session.id
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { user: { name: { contains: search } } },
      ]
    }

    if (status) where.status = status as any
    if (siteId) where.siteId = siteId
    if (clientId) where.site = { clientId }
    if (userId) where.userId = userId
    if (priority) where.priority = priority as any

    if (dateFrom || dateTo) {
      where.requiredDate = {}
      if (dateFrom) where.requiredDate.gte = new Date(dateFrom)
      if (dateTo) where.requiredDate.lte = new Date(dateTo + 'T23:59:59.999Z')
    }

    const [requisitions, total] = await Promise.all([
      db.requisition.findMany({
        where,
        include: {
          site: { include: { client: true } },
          user: { select: { id: true, name: true, email: true } },
          stockManagerApprovedBy: { select: { id: true, name: true } },
          adminApprovedBy: { select: { id: true, name: true } },
          boqItems: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { [sortField]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.requisition.count({ where }),
    ])

    return NextResponse.json({
      data: requisitions,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error: any) {
    console.error('GET /api/requisitions error:', error)
    return NextResponse.json({ error: 'Failed to fetch requisitions' }, { status: 500 })
  }
}

// POST /api/requisitions
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const {
      siteId, title, description, requiredDate, priority, notes,
      attachmentUrl, attachmentName, boqItems,
    } = body

    if (!siteId || !title || !requiredDate) {
      return NextResponse.json({ error: 'Site, title, and required date are required' }, { status: 400 })
    }

    // Calculate total from BOQ items
    let totalAmount = 0
    if (boqItems && Array.isArray(boqItems)) {
      for (const item of boqItems) {
        item.totalPrice = (item.quantity || 0) * (item.unitPrice || 0)
        totalAmount += item.totalPrice
      }
    }

    const requisition = await db.requisition.create({
      data: {
        siteId,
        userId: session.id,
        title,
        description: description || null,
        requiredDate: new Date(requiredDate),
        priority: priority || 'MEDIUM',
        totalAmount,
        notes: notes || null,
        attachmentUrl: attachmentUrl || null,
        attachmentName: attachmentName || null,
        boqItems: boqItems && boqItems.length > 0
          ? {
              create: boqItems.map((item: any) => ({
                itemName: item.itemName,
                description: item.description || null,
                quantity: item.quantity || 0,
                unit: item.unit || 'pcs',
                unitPrice: item.unitPrice || 0,
                totalPrice: item.totalPrice || 0,
                category: item.category || null,
                notes: item.notes || null,
              })),
            }
          : undefined,
      },
      include: {
        site: { include: { client: true } },
        user: { select: { id: true, name: true, email: true } },
        boqItems: { orderBy: { createdAt: 'asc' } },
      },
    })

    await createAuditLog({
      userId: session.id,
      action: 'CREATE_REQUISITION',
      entityType: 'REQUISITION',
      entityId: requisition.id,
      newValues: JSON.stringify({ title, siteId, totalAmount, boqCount: boqItems?.length || 0 }),
    })

    return NextResponse.json({ data: requisition }, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/requisitions error:', error)
    return NextResponse.json({ error: 'Failed to create requisition' }, { status: 500 })
  }
}
