import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'

// GET /api/advances/[id] — get single advance
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!checkPermission(session.role, 'VIEW_ALL_ADVANCES')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const advance = await db.advance.findUnique({
      where: { id },
      include: {
        site: { include: { client: true } },
        user: { select: { id: true, name: true, email: true } },
        accountantApprovedBy: { select: { id: true, name: true } },
        adminApprovedBy: { select: { id: true, name: true } },
        paidBy: { select: { id: true, name: true } },
      },
    })

    if (!advance) {
      return NextResponse.json({ error: 'Advance not found' }, { status: 404 })
    }

    // USER role can only see their own advances
    if (session.role === 'USER' && advance.userId !== session.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ advance })
  } catch (error) {
    console.error('GET /api/advances/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/advances/[id] — update advance (only PENDING)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { siteId, amount, purpose, notes } = body

    const existing = await db.advance.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Advance not found' }, { status: 404 })
    }

    // Only the creator or admin can update, and only if PENDING
    if (session.role !== 'ADMIN' && existing.userId !== session.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (existing.status !== 'PENDING') {
      return NextResponse.json({ error: 'Can only edit pending advances' }, { status: 400 })
    }

    const oldValues = JSON.stringify({
      siteId: existing.siteId,
      amount: existing.amount,
      purpose: existing.purpose,
      notes: existing.notes,
    })

    const updateData: any = {}
    if (siteId !== undefined) updateData.siteId = siteId
    if (amount !== undefined) {
      if (typeof amount !== 'number' || amount <= 0) {
        return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
      }
      updateData.amount = amount
    }
    if (purpose !== undefined) updateData.purpose = purpose
    if (notes !== undefined) updateData.notes = notes

    const advance = await db.advance.update({
      where: { id },
      data: updateData,
      include: {
        site: { include: { client: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    })

    const newValues = JSON.stringify(updateData)

    await createAuditLog({
      userId: session.id,
      action: 'UPDATE_ADVANCE',
      entityType: 'Advance',
      entityId: id,
      oldValues,
      newValues,
    })

    return NextResponse.json({ advance })
  } catch (error) {
    console.error('PUT /api/advances/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/advances/[id] — delete advance (only PENDING)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const existing = await db.advance.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Advance not found' }, { status: 404 })
    }

    if (session.role !== 'ADMIN' && existing.userId !== session.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (existing.status !== 'PENDING') {
      return NextResponse.json({ error: 'Can only delete pending advances' }, { status: 400 })
    }

    await db.advance.delete({ where: { id } })

    await createAuditLog({
      userId: session.id,
      action: 'DELETE_ADVANCE',
      entityType: 'Advance',
      entityId: id,
      oldValues: JSON.stringify({
        siteId: existing.siteId,
        amount: existing.amount,
        purpose: existing.purpose,
      }),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/advances/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
