import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'

// POST /api/advances/[id]/reject — PENDING/APPROVED -> REJECTED
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasPermission =
      checkPermission(session.role, 'ACCOUNTANT_APPROVE_ADVANCE') ||
      checkPermission(session.role, 'ADMIN_APPROVE_ADVANCE')

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { reason } = body

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 })
    }

    const advance = await db.advance.findUnique({ where: { id } })
    if (!advance) {
      return NextResponse.json({ error: 'Advance not found' }, { status: 404 })
    }

    if (advance.status !== 'PENDING' && advance.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Can only reject pending or approved advances' },
        { status: 400 }
      )
    }

    const updated = await db.advance.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason.trim(),
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
      action: 'REJECT_ADVANCE',
      entityType: 'Advance',
      entityId: id,
      oldValues: JSON.stringify({ status: advance.status }),
      newValues: JSON.stringify({ status: 'REJECTED', rejectionReason: reason.trim() }),
    })

    return NextResponse.json({ advance: updated })
  } catch (error) {
    console.error('POST /api/advances/[id]/reject error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
