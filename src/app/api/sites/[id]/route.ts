import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'

// GET /api/sites/[id] — single site with client + totals
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!checkPermission(session.role, 'MANAGE_SITES')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const site = await db.site.findUnique({
      where: { id },
      include: {
        client: true,
        _count: { select: { expenses: true, requisitions: true, advances: true } },
      },
    })

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    }

    // Get totals via GROUP BY
    const [expenseBySite, reqBySite, advBySite] = await Promise.all([
      db.expense.groupBy({ where: { siteId: id }, by: ['siteId'], _sum: { amount: true } }),
      db.requisition.groupBy({ where: { siteId: id }, by: ['siteId'], _sum: { totalAmount: true } }),
      db.advance.groupBy({ where: { siteId: id }, by: ['siteId'], _sum: { amount: true } }),
    ])

    const expenseSpent = expenseBySite[0]?._sum.amount || 0
    const reqSpent = reqBySite[0]?._sum.totalAmount || 0
    const advSpent = advBySite[0]?._sum.amount || 0
    const totalSpent = expenseSpent + reqSpent + advSpent

    return NextResponse.json({
      data: {
        ...site,
        totalSpent,
        remaining: site.budget - totalSpent,
      },
    })
  } catch (error) {
    console.error('GET /api/sites/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch site' }, { status: 500 })
  }
}

// PUT /api/sites/[id] — update
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!checkPermission(session.role, 'MANAGE_SITES')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { name, clientId, location, description, budget, isActive } = body

    const existing = await db.site.findUnique({
      where: { id },
      include: { client: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    }

    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return NextResponse.json({ error: 'Site name cannot be empty' }, { status: 400 })
    }

    // Validate client if being changed
    if (clientId && clientId !== existing.clientId) {
      const client = await db.client.findUnique({ where: { id: clientId } })
      if (!client) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (clientId !== undefined) updateData.clientId = clientId
    if (location !== undefined) updateData.location = location || null
    if (description !== undefined) updateData.description = description || null
    if (budget !== undefined) updateData.budget = typeof budget === 'number' ? budget : 0
    if (isActive !== undefined) updateData.isActive = isActive

    const site = await db.site.update({
      where: { id },
      data: updateData,
      include: {
        client: { select: { id: true, name: true } },
      },
    })

    await createAuditLog({
      userId: session.id,
      action: 'UPDATE_SITE',
      entityType: 'SITE',
      entityId: id,
      oldValues: JSON.stringify(existing),
      newValues: JSON.stringify(site),
    })

    return NextResponse.json({ data: site })
  } catch (error) {
    console.error('PUT /api/sites/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update site' }, { status: 500 })
  }
}

// DELETE /api/sites/[id] — delete
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!checkPermission(session.role, 'MANAGE_SITES')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const existing = await db.site.findUnique({
      where: { id },
      include: {
        _count: { select: { expenses: true, requisitions: true, advances: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    }

    const count = existing._count
    if (count.expenses > 0 || count.requisitions > 0 || count.advances > 0) {
      const parts: string[] = []
      if (count.expenses > 0) parts.push(`${count.expenses} expense(s)`)
      if (count.requisitions > 0) parts.push(`${count.requisitions} requisition(s)`)
      if (count.advances > 0) parts.push(`${count.advances} advance(s)`)
      return NextResponse.json(
        { error: `Cannot delete site with ${parts.join(', ')}` },
        { status: 400 }
      )
    }

    await db.site.delete({ where: { id } })

    await createAuditLog({
      userId: session.id,
      action: 'DELETE_SITE',
      entityType: 'SITE',
      entityId: id,
      oldValues: JSON.stringify(existing),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/sites/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete site' }, { status: 500 })
  }
}
