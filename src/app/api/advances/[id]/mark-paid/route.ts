import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'

// POST /api/advances/[id]/mark-paid — APPROVED -> PAID
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!checkPermission(session.role, 'MARK_PAID')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const advance = await db.advance.findUnique({ where: { id } })
    if (!advance) {
      return NextResponse.json({ error: 'Advance not found' }, { status: 404 })
    }

    if (advance.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Can only mark approved advances as paid' },
        { status: 400 }
      )
    }

    const now = new Date()

    const updated = await db.advance.update({
      where: { id },
      data: {
        status: 'PAID',
        paidById: session.id,
        paidAt: now,
      },
      include: {
        site: { include: { client: true } },
        user: { select: { id: true, name: true, email: true } },
        accountantApprovedBy: { select: { id: true, name: true } },
        adminApprovedBy: { select: { id: true, name: true } },
        paidBy: { select: { id: true, name: true } },
      },
    })

    await createAuditLog({
      userId: session.id,
      action: 'MARK_PAID_ADVANCE',
      entityType: 'Advance',
      entityId: id,
      oldValues: JSON.stringify({ status: advance.status }),
      newValues: JSON.stringify({ status: 'PAID', paidById: session.id }),
    })

    return NextResponse.json({ advance: updated })
  } catch (error) {
    console.error('POST /api/advances/[id]/mark-paid error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
