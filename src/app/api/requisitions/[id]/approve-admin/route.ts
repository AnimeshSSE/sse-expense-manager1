import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'

// POST /api/requisitions/[id]/approve-admin
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!checkPermission(session.role, 'ADMIN_APPROVE_MIR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const existing = await db.requisition.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.status !== 'STOCK_MANAGER_APPROVED') {
      return NextResponse.json({ error: 'Requisition is not in STOCK_MANAGER_APPROVED status' }, { status: 400 })
    }

    const requisition = await db.requisition.update({
      where: { id },
      data: {
        status: 'ADMIN_APPROVED',
        adminApprovedById: session.id,
        adminApprovedAt: new Date(),
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
      action: 'ADMIN_APPROVE_REQUISITION',
      entityType: 'REQUISITION',
      entityId: id,
      oldValues: JSON.stringify({ status: 'STOCK_MANAGER_APPROVED' }),
      newValues: JSON.stringify({ status: 'ADMIN_APPROVED' }),
    })

    return NextResponse.json({ data: requisition })
  } catch (error: any) {
    console.error('POST /api/requisitions/[id]/approve-admin error:', error)
    return NextResponse.json({ error: 'Failed to approve requisition' }, { status: 500 })
  }
}
