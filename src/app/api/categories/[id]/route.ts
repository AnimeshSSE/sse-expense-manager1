import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog, formatAuditValues } from '@/lib/audit';

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!checkPermission(session.role, 'MANAGE_CATEGORIES')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { name, type, description, isActive } = body;

    const existingCategory = await db.category.findUnique({ where: { id } });
    if (!existingCategory) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const oldValues = formatAuditValues({
      name: existingCategory.name,
      type: existingCategory.type,
      description: existingCategory.description,
      isActive: existingCategory.isActive,
    });

    const updatedCategory = await db.category.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(description !== undefined && { description: description || null }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    const newValues = formatAuditValues({
      name: updatedCategory.name,
      type: updatedCategory.type,
      description: updatedCategory.description,
      isActive: updatedCategory.isActive,
    });

    await createAuditLog({
      userId: session.id,
      action: 'UPDATE_CATEGORY',
      entityType: 'CATEGORY',
      entityId: id,
      oldValues,
      newValues,
    });

    return NextResponse.json({ category: updatedCategory });
  } catch (error: any) {
    console.error('Update category error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!checkPermission(session.role, 'MANAGE_CATEGORIES')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    const category = await db.category.findUnique({
      where: { id },
      include: {
        _count: { select: { expenses: true } },
      },
    });

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    if (category._count.expenses > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category with existing expenses' },
        { status: 400 }
      );
    }

    const oldValues = formatAuditValues({
      id: category.id,
      name: category.name,
      type: category.type,
    });

    await db.category.delete({ where: { id } });

    await createAuditLog({
      userId: session.id,
      action: 'DELETE_CATEGORY',
      entityType: 'CATEGORY',
      entityId: id,
      oldValues,
    });

    return NextResponse.json({ message: 'Category deleted successfully' });
  } catch (error: any) {
    console.error('Delete category error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
