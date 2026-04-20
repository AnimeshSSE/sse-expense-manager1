import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'
import { AdvanceStatus } from '@/lib/prisma-constants'

// GET /api/advances — list with filters + pagination
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!checkPermission(session.role, 'VIEW_ALL_ADVANCES')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const siteId = searchParams.get('siteId') || ''
    const userId = searchParams.get('userId') || ''
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)))
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    const where: any = {}

    if (search) {
      where.OR = [
        { purpose: { contains: search } },
        { notes: { contains: search } },
        { user: { name: { contains: search } } },
        { site: { name: { contains: search } } },
      ]
    }

    if (status && Object.values(AdvanceStatus).includes(status as AdvanceStatus)) {
      where.status = status as AdvanceStatus
    }

    if (siteId) {
      where.siteId = siteId
    }

    if (userId) {
      where.userId = userId
    }

    // Restrict USER role to only their own advances
    if (session.role === 'USER') {
      where.userId = session.id
    }

    const allowedSortFields = ['createdAt', 'updatedAt', 'amount', 'purpose', 'status']
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt'
    const sortDirection = sortOrder === 'asc' ? 'asc' : 'desc'

    const [advances, total] = await Promise.all([
      db.advance.findMany({
        where,
        include: {
          site: { include: { client: true } },
          user: { select: { id: true, name: true, email: true } },
          accountantApprovedBy: { select: { id: true, name: true } },
          adminApprovedBy: { select: { id: true, name: true } },
          paidBy: { select: { id: true, name: true } },
        },
        orderBy: { [sortField]: sortDirection },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.advance.count({ where }),
    ])

    return NextResponse.json({
      advances,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('GET /api/advances error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/advances — create with duplicate detection
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { siteId, amount, purpose, notes } = body

    if (!siteId || !amount || !purpose) {
      return NextResponse.json(
        { error: 'Missing required fields: siteId, amount, purpose' },
        { status: 400 }
      )
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
    }

    // Duplicate detection: same userId, siteId, amount, status=PENDING
    const existing = await db.advance.findFirst({
      where: {
        userId: session.id,
        siteId,
        amount,
        status: 'PENDING',
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Duplicate advance: A pending advance with the same site and amount already exists', duplicateId: existing.id },
        { status: 409 }
      )
    }

    // Verify site exists
    const site = await db.site.findUnique({ where: { id: siteId } })
    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    }

    const advance = await db.advance.create({
      data: {
        userId: session.id,
        siteId,
        amount,
        purpose,
        notes: notes || null,
        status: 'PENDING',
      },
      include: {
        site: { include: { client: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    })

    await createAuditLog({
      userId: session.id,
      action: 'CREATE_ADVANCE',
      entityType: 'Advance',
      entityId: advance.id,
      newValues: JSON.stringify({ siteId, amount, purpose, notes }),
    })

    return NextResponse.json({ advance }, { status: 201 })
  } catch (error) {
    console.error('POST /api/advances error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
