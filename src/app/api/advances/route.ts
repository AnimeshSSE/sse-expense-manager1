import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog, formatAuditValues } from '@/lib/audit';
import { Prisma, AdvanceStatus, Role } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');
    const siteId = searchParams.get('siteId');
    const clientId = searchParams.get('clientId');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const month = searchParams.get('month');

    const where: Prisma.AdvanceWhereInput = {};

    // Role-based filtering: users see own, admin/accountant see all
    if (!checkPermission(session.role, 'VIEW_ALL_EXPENSES')) {
      where.userId = session.id;
    }

    if (userId) where.userId = userId;
    if (status) {
      const statuses = status.split(',').filter(Boolean) as AdvanceStatus[];
      if (statuses.length === 1) where.status = statuses[0];
      else if (statuses.length > 1) where.status = { in: statuses };
    }
    if (siteId) where.siteId = siteId;
    if (clientId) where.site = { clientId };
    if (dateFrom || dateTo || month) {
      let from: Date | undefined;
      let to: Date | undefined;
      if (month) {
        const [year, mon] = month.split('-').map(Number);
        from = new Date(year, mon - 1, 1);
        to = new Date(year, mon, 0, 23, 59, 59);
      } else {
        if (dateFrom) from = new Date(dateFrom);
        if (dateTo) to = new Date(dateTo);
      }
      where.createdAt = { ...(from && { gte: from }), ...(to && { lte: to }) };
    }
    if (search) {
      where.OR = [
        { purpose: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { site: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const validSortFields = ['createdAt', 'amount', 'status', 'updatedAt'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const [advances, total] = await Promise.all([
      db.advance.findMany({
        where,
        include: {
          site: { include: { client: { select: { id: true, name: true } } } },
          user: { select: { id: true, name: true, email: true } },
          accountantApprovedBy: { select: { id: true, name: true } },
          adminApprovedBy: { select: { id: true, name: true } },
          paidBy: { select: { id: true, name: true } },
        },
        orderBy: { [sortField]: sortOrder === 'asc' ? 'asc' : 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.advance.count({ where }),
    ]);

    return NextResponse.json({
      advances,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error: any) {
    console.error('Get advances error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { siteId, amount, purpose, notes } = body;

    if (!siteId || !amount || !purpose) {
      return NextResponse.json(
        { error: 'Site, amount, and purpose are required' },
        { status: 400 }
      );
    }

    const siteExists = await db.site.findUnique({ where: { id: siteId } });
    if (!siteExists) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Duplicate detection: check if user has a pending advance with same amount and site
    const existingAdvance = await db.advance.findFirst({
      where: {
        userId: session.id,
        siteId,
        amount: parseFloat(amount),
        status: 'PENDING',
      },
    });
    if (existingAdvance) {
      return NextResponse.json(
        { error: 'You already have a pending advance of ₹' + amount + ' for this site', duplicateId: existingAdvance.id },
        { status: 409 }
      );
    }

    const advance = await db.advance.create({
      data: {
        userId: session.id,
        siteId,
        amount: parseFloat(amount),
        purpose,
        notes: notes || null,
      },
      include: {
        site: { include: { client: { select: { id: true, name: true } } } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await createAuditLog({
      userId: session.id,
      action: 'CREATE_ADVANCE',
      entityType: 'ADVANCE',
      entityId: advance.id,
      newValues: formatAuditValues({ siteId, amount: parseFloat(amount), purpose }),
    });

    return NextResponse.json({ advance }, { status: 201 });
  } catch (error: any) {
    console.error('Create advance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
