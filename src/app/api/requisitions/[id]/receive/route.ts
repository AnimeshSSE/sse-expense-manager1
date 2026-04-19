import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'

// POST /api/requisitions/[id]/receive
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!checkPermission(session.role, 'VIEW_ALL_MIRS')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const existing = await db.requisition.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.status !== 'ORDERED') {
      return NextResponse.json({ error: 'Requisition is not in ORDERED status' }, { status: 400 })
    }

    const requisition = await db.requisition.update({
      where: { id },
      data: { status: 'RECEIVED' },
      include: {
        site: { include: { client: true } },
        user: { select: { id: true, name: true, email: true } },
        stockManagerApprovedBy: { select: { id: true, name: true } },
        adminApprovedBy: { select: { id: true, name: true } },
        boqItems: { orderBy: { createdAt: 'asc' } },
      },
    })

    await createAuditLog({
      userId: session.id,
      action: 'RECEIVE_REQUISITION',
      entityType: 'REQUISITION',
      entityId: id,
      oldValues: JSON.stringify({ status: 'ORDERED' }),
      newValues: JSON.stringify({ status: 'RECEIVED' }),
    })

    return NextResponse.json({ data: requisition })
  } catch (error: any) {
    console.error('POST /api/requisitions/[id]/receive error:', error)
    return NextResponse.json({ error: 'Failed to mark requisition as received' }, { status: 500 })
  }
}
