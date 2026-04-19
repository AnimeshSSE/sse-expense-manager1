import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 })
    }

    const comments = await db.comment.findMany({
      where: { entityType, entityId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ comments })
  } catch (error) {
    console.error('Comments GET error:', error)
    return NextResponse.json({ error: 'Failed to load comments' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { entityType, entityId, content } = body

    if (!entityType || !entityId || !content || !content.trim()) {
      return NextResponse.json({ error: 'entityType, entityId, and content are required' }, { status: 400 })
    }

    const comment = await db.comment.create({
      data: {
        entityType,
        entityId,
        userId: session.id,
        content: content.trim(),
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    })

    await createAuditLog({
      userId: session.id,
      action: 'ADD_COMMENT',
      entityType,
      entityId,
      newValues: content.trim().substring(0, 500),
    })

    return NextResponse.json({ comment }, { status: 201 })
  } catch (error) {
    console.error('Comments POST error:', error)
    return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
  }
}
