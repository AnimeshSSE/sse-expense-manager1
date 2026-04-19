import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'
import { Prisma } from '@prisma/client'

// GET /api/requisitions/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    // Non-admin users can only view their own requisitions
    if (!checkPermission(session.role, 'VIEW_ALL_MIRS')) {
      const ownRequisition = await db.requisition.findFirst({
        where: { id, userId: session.id },
      })
      if (!ownRequisition) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const requisition = await db.requisition.findUnique({
      where: { id },
      include: {
        site: { include: { client: true } },
        user: { select: { id: true, name: true, email: true, role: true } },
        stockManagerApprovedBy: { select: { id: true, name: true } },
        adminApprovedBy: { select: { id: true, name: true } },
        boqItems: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (!requisition) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ data: requisition })
  } catch (error: any) {
    console.error('GET /api/requisitions/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch requisition' }, { status: 500 })
  }
}

// PUT /api/requisitions/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const {
      siteId, title, description, requiredDate, priority, notes,
      attachmentUrl, attachmentName, boqItems,
    } = body

    const existing = await db.requisition.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Only the owner, admin, or stock manager can edit
    if (existing.userId !== session.id && !checkPermission(session.role, 'VIEW_ALL_MIRS')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Only allow editing if PENDING or RETURNED
    if (!['PENDING', 'RETURNED'].includes(existing.status)) {
      return NextResponse.json({ error: 'Cannot edit requisition in current status' }, { status: 400 })
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

    // If boqItems array is provided, replace all existing items
    let updateData: any = {}
    if (siteId !== undefined) updateData.siteId = siteId
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (requiredDate !== undefined) updateData.requiredDate = new Date(requiredDate)
    if (priority !== undefined) updateData.priority = priority
    if (notes !== undefined) updateData.notes = notes
    if (attachmentUrl !== undefined) updateData.attachmentUrl = attachmentUrl
    if (attachmentName !== undefined) updateData.attachmentName = attachmentName
    updateData.totalAmount = totalAmount

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
      action: 'UPDATE_REQUISITION',
      entityType: 'REQUISITION',
      entityId: id,
      oldValues: JSON.stringify({ title: existing.title, totalAmount: existing.totalAmount }),
      newValues: JSON.stringify({ title: requisition.title, totalAmount: requisition.totalAmount }),
    })

    return NextResponse.json({ data: requisition })
  } catch (error: any) {
    console.error('PUT /api/requisitions/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update requisition' }, { status: 500 })
  }
}

// DELETE /api/requisitions/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const existing = await db.requisition.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Only owner or admin can delete, and only if PENDING or RETURNED
    if (existing.userId !== session.id && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!['PENDING', 'RETURNED', 'REJECTED'].includes(existing.status)) {
      return NextResponse.json({ error: 'Cannot delete requisition in current status' }, { status: 400 })
    }

    await db.requisition.delete({ where: { id } })

    await createAuditLog({
      userId: session.id,
      action: 'DELETE_REQUISITION',
      entityType: 'REQUISITION',
      entityId: id,
      oldValues: JSON.stringify({ title: existing.title }),
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('DELETE /api/requisitions/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete requisition' }, { status: 500 })
  }
}
