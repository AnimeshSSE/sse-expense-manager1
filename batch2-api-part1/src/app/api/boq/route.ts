import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (!checkPermission(session.role, 'VIEW_ALL_EXPENSES') && !checkPermission(session.role, 'VIEW_ALL_MIRS')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const siteIds = searchParams.get('siteIds');
    const unit = searchParams.get('unit');
    const priceFrom = searchParams.get('priceFrom');
    const priceTo = searchParams.get('priceTo');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');

    // Build where clause
    const where: Prisma.BOQItemWhereInput = {};

    if (siteIds) {
      const ids = siteIds.split(',').filter(Boolean);
      if (ids.length > 0) {
        where.requisition = { siteId: { in: ids } };
      }
    }

    if (unit) {
      where.unit = unit;
    }

    if (priceFrom) {
      where.unitPrice = { ...(where.unitPrice as any), gte: parseFloat(priceFrom) };
    }
    if (priceTo) {
      where.unitPrice = { ...(where.unitPrice as any), lte: parseFloat(priceTo) };
    }

    if (search) {
      where.OR = [
        { itemName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Build orderBy
    const validSortFields = ['createdAt', 'itemName', 'quantity', 'unitPrice', 'totalPrice', 'unit'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderBy: Prisma.BOQItemOrderByWithRelationInput = {
      [sortField]: sortOrder === 'asc' ? 'asc' : 'desc',
    };

    const [items, total] = await Promise.all([
      db.bOQItem.findMany({
        where,
        include: {
          requisition: {
            select: {
              id: true,
              title: true,
              status: true,
              site: {
                select: {
                  id: true,
                  name: true,
                  client: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.bOQItem.count({ where }),
    ]);

    return NextResponse.json({
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error: any) {
    console.error('Get BOQ items error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
