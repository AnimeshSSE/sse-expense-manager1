import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';


export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const clients = await db.client.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { sites: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      clients: clients.map(({ _count, ...c }) => ({
        ...c,
        siteCount: _count.sites,
      })),
    });
  } catch (error: any) {
    console.error('Get clients error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!checkPermission(session.role, 'MANAGE_CLIENTS')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Client name is required' },
        { status: 400 }
      );
    }

    const client = await db.client.create({
      data: {
        name,
        description: description || null,
      },
    });

    return NextResponse.json({ client }, { status: 201 });
  } catch (error: any) {
    console.error('Create client error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
