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

    const client = await db.client.findUnique({
      where: { id },
      include: { sites: true },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({ client });
  } catch (error: any) {
    console.error('Get client error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!checkPermission(session.role, 'MANAGE_CLIENTS')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { name, description, isActive } = body;

    const existingClient = await db.client.findUnique({ where: { id } });
    if (!existingClient) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const oldValues = formatAuditValues({
      name: existingClient.name,
      description: existingClient.description,
      isActive: existingClient.isActive,
    });

    const updatedClient = await db.client.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    const newValues = formatAuditValues({
      name: updatedClient.name,
      description: updatedClient.description,
      isActive: updatedClient.isActive,
    });

    await createAuditLog({
      userId: session.id,
      action: 'UPDATE_CLIENT',
      entityType: 'CLIENT',
      entityId: id,
      oldValues,
      newValues,
    });

    return NextResponse.json({ client: updatedClient });
  } catch (error: any) {
    console.error('Update client error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!checkPermission(session.role, 'MANAGE_CLIENTS')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    const client = await db.client.findUnique({
      where: { id },
      include: {
        _count: { select: { sites: true } },
      },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    if (client._count.sites > 0) {
      return NextResponse.json(
        { error: 'Cannot delete client with existing sites. Delete all sites first.' },
        { status: 400 }
      );
    }

    const oldValues = formatAuditValues({
      id: client.id,
      name: client.name,
      description: client.description,
    });

    await db.client.delete({ where: { id } });

    await createAuditLog({
      userId: session.id,
      action: 'DELETE_CLIENT',
      entityType: 'CLIENT',
      entityId: id,
      oldValues,
    });

    return NextResponse.json({ message: 'Client deleted successfully' });
  } catch (error: any) {
    console.error('Delete client error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
