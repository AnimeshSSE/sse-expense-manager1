import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog, formatAuditValues } from '@/lib/audit';
import { Prisma, RequisitionStatus, Priority } from '@prisma/client';

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
    const clientId = searchParams.get('clientId');
    const siteIds = searchParams.get('siteIds');
    const priority = searchParams.get('priority');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build where clause
    const where: Prisma.RequisitionWhereInput = {};

    // Role-based filtering
    if (!checkPermission(session.role, 'VIEW_ALL_MIRS')) {
      where.userId = session.id;
    }

    if (status) {
      where.status = status as RequisitionStatus;
    }

    if (clientId) {
      where.site = { clientId };
    }

    if (siteIds) {
      const ids = siteIds.split(',').filter(Boolean);
      if (ids.length > 0) {
        where.siteId = { in: ids };
      }
    }

    if (priority) {
      where.priority = priority as Priority;
    }

    if (dateFrom) {
      where.requiredDate = { ...(where.requiredDate as any), gte: new Date(dateFrom) };
    }
    if (dateTo) {
      where.requiredDate = { ...(where.requiredDate as any), lte: new Date(dateTo) };
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { user: { name: { contains: search } } },
      ];
    }

    // Build orderBy
    const validSortFields = ['createdAt', 'requiredDate', 'totalAmount', 'status', 'priority', 'updatedAt', 'title'];
    const direction = sortOrder === 'asc' ? 'asc' : 'desc';
    const nestedSortMap: Record<string, Prisma.RequisitionOrderByWithRelationInput> = {
      'site.name': { site: { name: direction } },
      'user.name': { user: { name: direction } },
    };

    let orderBy: Prisma.RequisitionOrderByWithRelationInput;
    if (nestedSortMap[sortBy]) {
      orderBy = nestedSortMap[sortBy];
    } else {
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
      orderBy = { [sortField]: direction };
    }

    const [requisitions, total] = await Promise.all([
      db.requisition.findMany({
        where,
        include: {
          site: {
            include: {
              client: { select: { id: true, name: true } },
            },
          },
          user: { select: { id: true, name: true, email: true } },
          boqItems: true,
          stockManagerApprovedBy: { select: { id: true, name: true } },
          adminApprovedBy: { select: { id: true, name: true } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.requisition.count({ where }),
    ]);

    return NextResponse.json({
      requisitions,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error: any) {
    console.error('Get requisitions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!checkPermission(session.role, 'SUBMIT_MIR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      siteId,
      title,
      description,
      requiredDate,
      priority,
      notes,
      attachmentUrl,
      attachmentName,
      boqItems,
    } = body;

    if (!siteId || !title || !requiredDate) {
      return NextResponse.json(
        { error: 'Site, title, and required date are required' },
        { status: 400 }
      );
    }

    if (!boqItems || !Array.isArray(boqItems) || boqItems.length === 0) {
      return NextResponse.json(
        { error: 'At least one BOQ item is required' },
        { status: 400 }
      );
    }

    // Validate site exists
    const siteExists = await db.site.findUnique({ where: { id: siteId } });
    if (!siteExists) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Calculate total amount from BOQ items
    const totalAmount = boqItems.reduce((sum: number, item: any) => {
      const quantity = parseFloat(item.quantity) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      return sum + quantity * unitPrice;
    }, 0);

    const requisition = await db.requisition.create({
      data: {
        siteId,
        userId: session.id,
        title,
        description: description || null,
        requiredDate: new Date(requiredDate),
        priority: priority || 'MEDIUM',
        totalAmount,
        notes: notes || null,
        attachmentUrl: attachmentUrl || null,
        attachmentName: attachmentName || null,
        boqItems: {
          create: boqItems.map((item: any) => ({
            itemName: item.itemName,
            description: item.description || null,
            quantity: parseFloat(item.quantity) || 0,
            unit: item.unit || '',
            unitPrice: parseFloat(item.unitPrice) || 0,
            totalPrice: (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0),
            category: item.category || null,
            notes: item.notes || null,
          })),
        },
      },
      include: {
        site: {
          include: { client: { select: { id: true, name: true } } },
        },
        user: { select: { id: true, name: true, email: true } },
        boqItems: true,
      },
    });

    await createAuditLog({
      userId: session.id,
      action: 'CREATE_REQUISITION',
      entityType: 'REQUISITION',
      entityId: requisition.id,
      newValues: formatAuditValues({
        siteId,
        title,
        requiredDate,
        priority: priority || 'MEDIUM',
        totalAmount,
        boqItemCount: boqItems.length,
      }),
    });

    return NextResponse.json({ requisition }, { status: 201 });
  } catch (error: any) {
    console.error('Create requisition error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
