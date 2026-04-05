import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (!checkPermission(session.role, 'VIEW_ALL_EXPENSES')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 });
    }

    const comments = await db.comment.findMany({
      where: { entityType, entityId },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ comments });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { entityType, entityId, content } = await request.json();
    if (!entityType || !entityId || !content?.trim()) {
      return NextResponse.json({ error: 'entityType, entityId, and content are required' }, { status: 400 });
    }

    const comment = await db.comment.create({
      data: { entityType, entityId, userId: session.id, content: content.trim() },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });

    await createAuditLog({
      userId: session.id,
      action: 'ADD_COMMENT',
      entityType,
      entityId,
      newValues: { content: content.trim() },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
