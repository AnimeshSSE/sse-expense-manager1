import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!checkPermission(session.role, 'APPROVE_LEAVE')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { reason } = body

    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 })
    }

    const leave = await db.leave.findUnique({ where: { id } })
    if (!leave) return NextResponse.json({ error: 'Leave not found' }, { status: 404 })

    if (leave.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only pending leaves can be rejected' }, { status: 400 })
    }

    const updated = await db.leave.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedById: session.id,
        approvedAt: new Date(),
        rejectionReason: reason.trim(),
      },
      include: {
        employee: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        approvedBy: { select: { id: true, name: true } },
      },
    })

    await createAuditLog({
      userId: session.id,
      action: 'REJECT_LEAVE',
      entityType: 'Leave',
      entityId: id,
      newValues: JSON.stringify({ status: 'REJECTED', reason: reason.trim() }),
    })

    return NextResponse.json({ leave: updated })
  } catch (error) {
    console.error('POST /api/leaves/[id]/reject error:', error)
    return NextResponse.json({ error: 'Failed to reject leave' }, { status: 500 })
  }
}
