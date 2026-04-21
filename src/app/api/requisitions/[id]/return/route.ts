import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'

// POST /api/requisitions/[id]/return
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
    const { reason } = await req.json()

    if (!reason) {
      return NextResponse.json({ error: 'Return reason is required' }, { status: 400 })
    }

    const existing = await db.requisition.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const returnableStatuses = ['PENDING', 'STOCK_MANAGER_APPROVED', 'ADMIN_APPROVED']
    if (!returnableStatuses.includes(existing.status)) {
      return NextResponse.json({ error: `Cannot return requisition in ${existing.status} status` }, { status: 400 })
    }

    const requisition = await db.requisition.update({
      where: { id },
      data: {
        status: 'RETURNED',
        returnReason: reason,
      },
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
      action: 'RETURN_REQUISITION',
      entityType: 'REQUISITION',
      entityId: id,
      oldValues: JSON.stringify({ status: existing.status }),
      newValues: JSON.stringify({ status: 'RETURNED', reason }),
    })

    return NextResponse.json({ data: requisition })
  } catch (error: any) {
    console.error('POST /api/requisitions/[id]/return error:', error)
    return NextResponse.json({ error: 'Failed to return requisition' }, { status: 500 })
  }
}
