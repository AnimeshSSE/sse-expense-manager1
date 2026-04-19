import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'
import { ExpenseStatus, PaymentMethod } from '@prisma/client'

// GET /api/expenses — list with filters + pagination
export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sp = req.nextUrl.searchParams
    const search = sp.get('search') || ''
    const status = sp.get('status') || ''
    const siteId = sp.get('siteId') || ''
    const categoryId = sp.get('categoryId') || ''
    const clientId = sp.get('clientId') || ''
    const dateFrom = sp.get('dateFrom') || ''
    const dateTo = sp.get('dateTo') || ''
    const amountFrom = sp.get('amountFrom') || ''
    const amountTo = sp.get('amountTo') || ''
    const lateOnly = sp.get('lateOnly') === 'true'
    const paymentMethods = sp.get('paymentMethods') || ''
    const userId = sp.get('userId') || ''
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '20', 10) || 20))
    const sortBy = sp.get('sortBy') || 'createdAt'
    const sortOrder = sp.get('sortOrder') || 'desc'

    const allowedSortFields = ['createdAt', 'updatedAt', 'expenseDate', 'amount', 'status', 'description']
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt'
    const orderDir = sortOrder === 'asc' ? 'asc' : 'desc'

    // Build where clause
    const where: Record<string, unknown> = {}

    if (!checkPermission(session.role, 'VIEW_ALL_EXPENSES')) {
      where.userId = session.id
    }

    if (search) {
      where.description = { contains: search }
    }

    if (status) {
      where.status = status as ExpenseStatus
    }

    if (siteId) {
      where.siteId = siteId
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    if (clientId) {
      where.site = { clientId }
    }

    if (dateFrom) {
      where.expenseDate = { ...((where.expenseDate as Record<string, unknown>) || {}), gte: new Date(dateFrom) }
    }

    if (dateTo) {
      where.expenseDate = { ...((where.expenseDate as Record<string, unknown>) || {}), lte: new Date(dateTo) }
    }

    if (amountFrom) {
      where.amount = { ...((where.amount as Record<string, unknown>) || {}), gte: parseFloat(amountFrom) }
    }

    if (amountTo) {
      where.amount = { ...((where.amount as Record<string, unknown>) || {}), lte: parseFloat(amountTo) }
    }

    if (lateOnly) {
      where.isLateSubmission = true
    }

    if (paymentMethods) {
      const methods = paymentMethods.split(',').filter((m) => Object.values(PaymentMethod).includes(m as PaymentMethod))
      if (methods.length > 0) {
        where.paymentMethod = { in: methods }
      }
    }

    if (userId && checkPermission(session.role, 'VIEW_ALL_EXPENSES')) {
      where.userId = userId
    }

    const [data, total] = await Promise.all([
      db.expense.findMany({
        where,
        include: {
          site: { include: { client: true } },
          category: true,
          user: { select: { id: true, name: true, email: true } },
          accountantApprovedBy: { select: { id: true, name: true } },
          adminApprovedBy: { select: { id: true, name: true } },
        },
        orderBy: { [sortField]: orderDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.expense.count({ where }),
    ])

    return NextResponse.json({
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error) {
    console.error('GET /api/expenses error:', error)
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 })
  }
}

// POST /api/expenses — create
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      siteId, categoryId, amount, description, expenseDate,
      sellerName, invoiceNumber, paymentMethod, notes, userId: bodyUserId,
    } = body

    if (!siteId || !categoryId || !amount || !description || !expenseDate) {
      return NextResponse.json({ error: 'Missing required fields: siteId, categoryId, amount, description, expenseDate' }, { status: 400 })
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
    }

    // Validate site and category exist
    const [site, category] = await Promise.all([
      db.site.findUnique({ where: { id: siteId } }),
      db.category.findUnique({ where: { id: categoryId } }),
    ])

    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 })

    // Role-based userId assignment
    let expenseUserId = session.id
    if (bodyUserId && checkPermission(session.role, 'VIEW_ALL_EXPENSES')) {
      const targetUser = await db.user.findUnique({ where: { id: bodyUserId }, select: { id: true, isActive: true } })
      if (!targetUser || !targetUser.isActive) {
        return NextResponse.json({ error: 'Target user not found or inactive' }, { status: 400 })
      }
      expenseUserId = bodyUserId
    }

    const expenseDateObj = new Date(expenseDate)
    const now = new Date()
    const diffMs = now.getTime() - expenseDateObj.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const isLateSubmission = diffDays > 7
    const daysLate = isLateSubmission ? diffDays : 0

    const expense = await db.expense.create({
      data: {
        siteId,
        categoryId,
        userId: expenseUserId,
        amount,
        description,
        expenseDate: expenseDateObj,
        sellerName: sellerName || null,
        invoiceNumber: invoiceNumber || null,
        paymentMethod: (paymentMethod as PaymentMethod) || PaymentMethod.CASH,
        notes: notes || null,
        isLateSubmission,
        daysLate,
      },
      include: {
        site: { include: { client: true } },
        category: true,
        user: { select: { id: true, name: true, email: true } },
      },
    })

    await createAuditLog({
      userId: session.id,
      action: 'CREATE_EXPENSE',
      entityType: 'EXPENSE',
      entityId: expense.id,
      newValues: JSON.stringify({ ...expense, isLateSubmission, daysLate }),
    })

    return NextResponse.json({ data: expense }, { status: 201 })
  } catch (error) {
    console.error('POST /api/expenses error:', error)
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 })
  }
}
