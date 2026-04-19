import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'
import { CategoryType } from '@prisma/client'

// GET /api/categories/[id] — single category
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!checkPermission(session.role, 'MANAGE_CATEGORIES')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const category = await db.category.findUnique({
      where: { id },
      include: {
        _count: { select: { expenses: true } },
      },
    })

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    return NextResponse.json({ data: category })
  } catch (error) {
    console.error('GET /api/categories/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch category' }, { status: 500 })
  }
}

// PUT /api/categories/[id] — update
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!checkPermission(session.role, 'MANAGE_CATEGORIES')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    const { name, type, description, isActive } = body

    const existing = await db.category.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return NextResponse.json({ error: 'Category name cannot be empty' }, { status: 400 })
    }

    if (type && !Object.values(CategoryType).includes(type)) {
      return NextResponse.json({ error: `Invalid type. Must be one of: ${Object.values(CategoryType).join(', ')}` }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (type !== undefined) updateData.type = type
    if (description !== undefined) updateData.description = description || null
    if (isActive !== undefined) updateData.isActive = isActive

    const category = await db.category.update({
      where: { id },
      data: updateData,
    })

    await createAuditLog({
      userId: session.id,
      action: 'UPDATE_CATEGORY',
      entityType: 'CATEGORY',
      entityId: id,
      oldValues: JSON.stringify(existing),
      newValues: JSON.stringify(category),
    })

    return NextResponse.json({ data: category })
  } catch (error) {
    console.error('PUT /api/categories/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
  }
}

// DELETE /api/categories/[id] — delete
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!checkPermission(session.role, 'MANAGE_CATEGORIES')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const existing = await db.category.findUnique({
      where: { id },
      include: {
        _count: { select: { expenses: true } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    if (existing._count.expenses > 0) {
      return NextResponse.json(
        { error: `Cannot delete category with ${existing._count.expenses} expense(s). Delete or reassign expenses first.` },
        { status: 400 }
      )
    }

    await db.category.delete({ where: { id } })

    await createAuditLog({
      userId: session.id,
      action: 'DELETE_CATEGORY',
      entityType: 'CATEGORY',
      entityId: id,
      oldValues: JSON.stringify(existing),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/categories/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }
}
