import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog, formatAuditValues } from '@/lib/audit';
import { Prisma, ExpenseStatus, PaymentMethod, Role } from '@prisma/client';

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
    const categoryIds = searchParams.get('categoryIds');
    const paymentMethods = searchParams.get('paymentMethods');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const amountFrom = searchParams.get('amountFrom');
    const amountTo = searchParams.get('amountTo');
    const lateOnly = searchParams.get('lateOnly');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build where clause
    const where: Prisma.ExpenseWhereInput = {};

    // Role-based filtering
    if (!checkPermission(session.role, 'VIEW_ALL_EXPENSES')) {
      where.userId = session.id;
    }

    if (status) {
      const statuses = status.split(',').filter(Boolean) as ExpenseStatus[];
      if (statuses.length === 1) {
        where.status = statuses[0];
      } else if (statuses.length > 1) {
        where.status = { in: statuses };
      }
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

    if (categoryIds) {
      const ids = categoryIds.split(',').filter(Boolean);
      if (ids.length > 0) {
        where.categoryId = { in: ids };
      }
    }

    if (paymentMethods) {
      const methods = paymentMethods.split(',').filter(Boolean);
      const validMethods = methods.filter((m): m is PaymentMethod => (Object.values(PaymentMethod) as string[]).includes(m));
      if (validMethods.length === 1) {
        where.paymentMethod = validMethods[0];
      } else if (validMethods.length > 1) {
        where.paymentMethod = { in: validMethods };
      }
    }

    if (dateFrom) {
      where.expenseDate = { ...(where.expenseDate as any), gte: new Date(dateFrom) };
    }
    if (dateTo) {
      where.expenseDate = { ...(where.expenseDate as any), lte: new Date(dateTo) };
    }

    if (amountFrom) {
      where.amount = { ...(where.amount as any), gte: parseFloat(amountFrom) };
    }
    if (amountTo) {
      where.amount = { ...(where.amount as any), lte: parseFloat(amountTo) };
    }

    if (lateOnly === 'true') {
      where.isLateSubmission = true;
    }

    if (search) {
      where.OR = [
        { description: { contains: search } },
        { sellerName: { contains: search } },
        { invoiceNumber: { contains: search } },
        { user: { name: { contains: search } } },
      ];
    }

    // Build orderBy
    const validSortFields = ['createdAt', 'expenseDate', 'amount', 'status', 'updatedAt'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderBy: Prisma.ExpenseOrderByWithRelationInput = {
      [sortField]: sortOrder === 'asc' ? 'asc' : 'desc',
    };

    const [expenses, total] = await Promise.all([
      db.expense.findMany({
        where,
        include: {
          site: {
            include: {
              client: { select: { id: true, name: true } },
            },
          },
          category: { select: { id: true, name: true } },
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.expense.count({ where }),
    ]);

    return NextResponse.json({
      expenses,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error: any) {
    console.error('Get expenses error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!checkPermission(session.role, 'SUBMIT_EXPENSE')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      siteId,
      categoryId,
      amount,
      description,
      expenseDate,
      sellerName,
      invoiceNumber,
      paymentMethod,
      receiptUrl,
      receiptFileName,
      notes,
    } = body;

    if (!siteId || !categoryId || !amount || !description || !expenseDate) {
      return NextResponse.json(
        { error: 'Site, category, amount, description, and expense date are required' },
        { status: 400 }
      );
    }

    // Validate site and category exist
    const [siteExists, categoryExists] = await Promise.all([
      db.site.findUnique({ where: { id: siteId } }),
      db.category.findUnique({ where: { id: categoryId } }),
    ]);

    if (!siteExists) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }
    if (!categoryExists) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const submissionDate = new Date();
    const expenseDateObj = new Date(expenseDate);
    const daysDiff = Math.floor(
      (submissionDate.getTime() - expenseDateObj.getTime()) / (1000 * 60 * 60 * 24)
    );
    const isLateSubmission = daysDiff > 3;
    const daysLate = isLateSubmission ? daysDiff : 0;

    const expense = await db.expense.create({
      data: {
        siteId,
        categoryId,
        userId: session.id,
        amount: parseFloat(amount),
        description,
        expenseDate: new Date(expenseDate),
        submissionDate,
        sellerName: sellerName || null,
        invoiceNumber: invoiceNumber || null,
        paymentMethod: paymentMethod || 'CASH',
        receiptUrl: receiptUrl || null,
        receiptFileName: receiptFileName || null,
        notes: notes || null,
        isLateSubmission,
        daysLate,
      },
      include: {
        site: {
          include: { client: { select: { id: true, name: true } } },
        },
        category: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await createAuditLog({
      userId: session.id,
      action: 'CREATE_EXPENSE',
      entityType: 'EXPENSE',
      entityId: expense.id,
      newValues: formatAuditValues({
        siteId,
        categoryId,
        amount: parseFloat(amount),
        description,
        expenseDate,
        paymentMethod: paymentMethod || 'CASH',
        isLateSubmission,
        daysLate,
      }),
    });

    return NextResponse.json({ expense }, { status: 201 });
  } catch (error: any) {
    console.error('Create expense error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
