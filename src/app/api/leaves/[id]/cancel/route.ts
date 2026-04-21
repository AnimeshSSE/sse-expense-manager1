import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const leave = await db.leave.findUnique({
      where: { id },
      include: {
        employee: { select: { userId: true } },
      },
    })
    if (!leave) return NextResponse.json({ error: 'Leave not found' }, { status: 404 })

    // Only the owner can cancel
    if (leave.employee.userId !== session.id) {
      return NextResponse.json({ error: 'Only the leave owner can cancel' }, { status: 403 })
    }

    if (leave.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only pending leaves can be cancelled' }, { status: 400 })
    }

    const updated = await db.leave.update({
      where: { id },
      data: { status: 'CANCELLED' },
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
      action: 'CANCEL_LEAVE',
      entityType: 'Leave',
      entityId: id,
      newValues: JSON.stringify({ status: 'CANCELLED' }),
    })

    return NextResponse.json({ leave: updated })
  } catch (error) {
    console.error('POST /api/leaves/[id]/cancel error:', error)
    return NextResponse.json({ error: 'Failed to cancel leave' }, { status: 500 })
  }
}
