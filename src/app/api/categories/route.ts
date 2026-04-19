import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'
import { CategoryType } from '@prisma/client'

// GET /api/categories — list with filters + pagination
export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!checkPermission(session.role, 'MANAGE_CATEGORIES')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const sp = req.nextUrl.searchParams
    const isActive = sp.get('isActive')
    const type = sp.get('type') || ''
    const search = sp.get('search') || ''
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '20', 10) || 20))

    const where: Record<string, unknown> = {}

    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true'
    }

    if (type && Object.values(CategoryType).includes(type as CategoryType)) {
      where.type = type as CategoryType
    }

    if (search) {
      where.name = { contains: search }
    }

    const [data, total] = await Promise.all([
      db.category.findMany({
        where,
        include: {
          _count: { select: { expenses: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.category.count({ where }),
    ])

    return NextResponse.json({
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('GET /api/categories error:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

// POST /api/categories — create
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!checkPermission(session.role, 'MANAGE_CATEGORIES')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { name, type, description, isActive } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    if (type && !Object.values(CategoryType).includes(type)) {
      return NextResponse.json({ error: `Invalid type. Must be one of: ${Object.values(CategoryType).join(', ')}` }, { status: 400 })
    }

    const category = await db.category.create({
      data: {
        name: name.trim(),
        type: type || CategoryType.BOTH,
        description: description || null,
        isActive: isActive !== undefined ? isActive : true,
      },
    })

    await createAuditLog({
      userId: session.id,
      action: 'CREATE_CATEGORY',
      entityType: 'CATEGORY',
      entityId: category.id,
      newValues: JSON.stringify(category),
    })

    return NextResponse.json({ data: category }, { status: 201 })
  } catch (error) {
    console.error('POST /api/categories error:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}
