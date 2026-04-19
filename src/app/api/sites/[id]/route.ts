import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog, formatAuditValues } from '@/lib/audit';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;

    const site = await db.site.findUnique({
      where: { id },
      include: { client: true },
    });

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    return NextResponse.json({ site });
  } catch (error: any) {
    console.error('Get site error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!checkPermission(session.role, 'MANAGE_SITES')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { name, clientId, location, description, budget, isActive } = body;

    const existingSite = await db.site.findUnique({ where: { id } });
    if (!existingSite) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    if (clientId) {
      const clientExists = await db.client.findUnique({ where: { id: clientId } });
      if (!clientExists) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }
    }

    const oldValues = formatAuditValues({
      name: existingSite.name,
      clientId: existingSite.clientId,
      location: existingSite.location,
      description: existingSite.description,
      budget: existingSite.budget,
      isActive: existingSite.isActive,
    });

    const updatedSite = await db.site.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(clientId !== undefined && { clientId }),
        ...(location !== undefined && { location: location || null }),
        ...(description !== undefined && { description: description || null }),
        ...(budget !== undefined && { budget }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    const newValues = formatAuditValues({
      name: updatedSite.name,
      clientId: updatedSite.clientId,
      location: updatedSite.location,
      description: updatedSite.description,
      budget: updatedSite.budget,
      isActive: updatedSite.isActive,
    });

    await createAuditLog({
      userId: session.id,
      action: 'UPDATE_SITE',
      entityType: 'SITE',
      entityId: id,
      oldValues,
      newValues,
    });

    return NextResponse.json({ site: updatedSite });
  } catch (error: any) {
    console.error('Update site error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!checkPermission(session.role, 'MANAGE_SITES')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    const site = await db.site.findUnique({
      where: { id },
      include: {
        _count: {
          select: { expenses: true, requisitions: true },
        },
      },
    });

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    if (site._count.expenses > 0 || site._count.requisitions > 0) {
      return NextResponse.json(
        { error: 'Cannot delete site with existing expenses or requisitions' },
        { status: 400 }
      );
    }

    const oldValues = formatAuditValues({
      id: site.id,
      name: site.name,
      clientId: site.clientId,
    });

    await db.site.delete({ where: { id } });

    await createAuditLog({
      userId: session.id,
      action: 'DELETE_SITE',
      entityType: 'SITE',
      entityId: id,
      oldValues,
    });

    return NextResponse.json({ message: 'Site deleted successfully' });
  } catch (error: any) {
    console.error('Delete site error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
