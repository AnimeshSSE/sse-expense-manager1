import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    let employeeId = searchParams.get('employeeId')
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')

    // USER role: force filter to own employeeId
    if (!checkPermission(session.role, 'VIEW_ALL_LEAVES')) {
      const myEmployee = await db.employee.findUnique({
        where: { userId: session.id },
        select: { id: true },
      })
      if (!myEmployee) {
        return NextResponse.json({ leaves: [], pagination: { page: 1, pageSize: 1, total: 0, totalPages: 0 } })
      }
      employeeId = myEmployee.id
    }

    const where: Record<string, unknown> = {}
    if (employeeId) where.employeeId = employeeId
    if (status) where.status = status
    if (type) where.type = type
    if (dateFrom || dateTo) {
      where.startDate = {}
      if (dateFrom) (where.startDate as Record<string, unknown>).gte = new Date(dateFrom)
      if (dateTo) (where.startDate as Record<string, unknown>).lte = new Date(dateTo)
    }

    const [leaves, total] = await Promise.all([
      db.leave.findMany({
        where,
        include: {
          employee: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          approvedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.leave.count({ where }),
    ])

    return NextResponse.json({
      leaves,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    console.error('GET /api/leaves error:', error)
    return NextResponse.json({ error: 'Failed to fetch leaves' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { employeeId, type, startDate, endDate, totalDays, reason } = body

    // Find employee for this user
    let targetEmployeeId = employeeId
    if (!checkPermission(session.role, 'VIEW_ALL_LEAVES')) {
      // USER role: must be their own employee
      const myEmployee = await db.employee.findUnique({
        where: { userId: session.id },
        select: { id: true },
      })
      if (!myEmployee) return NextResponse.json({ error: 'Employee profile not found' }, { status: 404 })
      targetEmployeeId = myEmployee.id
    }

    if (!targetEmployeeId || !type || !startDate || !endDate) {
      return NextResponse.json({ error: 'Employee, type, start date, and end date are required' }, { status: 400 })
    }

    // Verify employee exists
    const employee = await db.employee.findUnique({ where: { id: targetEmployeeId } })
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const days = type === 'HALF_DAY' ? 0.5 : Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

    const leave = await db.leave.create({
      data: {
        employeeId: targetEmployeeId,
        type,
        startDate: start,
        endDate: end,
        totalDays: totalDays || days,
        reason: reason || null,
        status: 'PENDING',
      },
      include: {
        employee: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    })

    await createAuditLog({
      userId: session.id,
      action: 'CREATE_LEAVE',
      entityType: 'Leave',
      entityId: leave.id,
      newValues: JSON.stringify({ employeeId: targetEmployeeId, type, startDate, endDate, totalDays: leave.totalDays }),
    })

    return NextResponse.json({ leave }, { status: 201 })
  } catch (error) {
    console.error('POST /api/leaves error:', error)
    return NextResponse.json({ error: 'Failed to create leave' }, { status: 500 })
  }
}
