import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

// POST /api/requisitions/[id]/resubmit
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const {
      title, description, requiredDate, priority, notes,
      attachmentUrl, attachmentName, boqItems,
    } = body

    const existing = await db.requisition.findUnique({
      where: { id },
      include: { boqItems: true },
    })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Only owner can resubmit
    if (existing.userId !== session.id && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Can only resubmit from RETURNED or REJECTED status
    if (!['RETURNED', 'REJECTED'].includes(existing.status)) {
      return NextResponse.json({ error: `Cannot resubmit requisition in ${existing.status} status` }, { status: 400 })
    }

    // Calculate total from BOQ items if provided
    let totalAmount = existing.totalAmount
    if (boqItems !== undefined) {
      totalAmount = 0
      for (const item of boqItems) {
        item.totalPrice = (item.quantity || 0) * (item.unitPrice || 0)
        totalAmount += item.totalPrice
      }
    }

    const updateData: any = {
      status: 'PENDING',
      rejectionReason: null,
      returnReason: null,
      totalAmount,
    }

    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (requiredDate !== undefined) updateData.requiredDate = new Date(requiredDate)
    if (priority !== undefined) updateData.priority = priority
    if (notes !== undefined) updateData.notes = notes
    if (attachmentUrl !== undefined) updateData.attachmentUrl = attachmentUrl
    if (attachmentName !== undefined) updateData.attachmentName = attachmentName

    if (boqItems !== undefined) {
      updateData.boqItems = {
        deleteMany: {},
        create: boqItems.map((item: any) => ({
          itemName: item.itemName,
          description: item.description || null,
          quantity: item.quantity || 0,
          unit: item.unit || 'pcs',
          unitPrice: item.unitPrice || 0,
          totalPrice: item.totalPrice || 0,
          category: item.category || null,
          notes: item.notes || null,
        })),
      }
    }

    const requisition = await db.requisition.update({
      where: { id },
      data: updateData,
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
      action: 'RESUBMIT_REQUISITION',
      entityType: 'REQUISITION',
      entityId: id,
      oldValues: JSON.stringify({ status: existing.status }),
      newValues: JSON.stringify({ status: 'PENDING', title: requisition.title }),
    })

    return NextResponse.json({ data: requisition })
  } catch (error: any) {
    console.error('POST /api/requisitions/[id]/resubmit error:', error)
    return NextResponse.json({ error: 'Failed to resubmit requisition' }, { status: 500 })
  }
}
