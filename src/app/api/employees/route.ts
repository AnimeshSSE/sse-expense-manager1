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
    const userIdFilter = searchParams.get('userId')
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    const search = searchParams.get('search') || ''

    // USER role can only see their own employee
    if (!checkPermission(session.role, 'MANAGE_EMPLOYEES')) {
      const myEmployee = await db.employee.findUnique({
        where: { userId: session.id },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      })
      if (!myEmployee) {
        return NextResponse.json({ employees: [], pagination: { page: 1, pageSize: 1, total: 0, totalPages: 0 } })
      }
      return NextResponse.json({
        employees: [myEmployee],
        pagination: { page: 1, pageSize: 1, total: 1, totalPages: 1 },
      })
    }

    // ADMIN: build where clause
    const where: Record<string, unknown> = {}
    if (userIdFilter) where.userId = userIdFilter
    if (search) {
      where.OR = [
        { employeeCode: { contains: search } },
        { designation: { contains: search } },
        { department: { contains: search } },
        { user: { name: { contains: search } } },
      ]
    }

    const [employees, total] = await Promise.all([
      db.employee.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.employee.count({ where }),
    ])

    return NextResponse.json({
      employees,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (error) {
    console.error('GET /api/employees error:', error)
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!checkPermission(session.role, 'MANAGE_EMPLOYEES')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, employeeCode, designation, department, phone, address, joiningDate, baseSalary, bankAccount, bankName, bankIfsc, panNumber, aadhaarNumber, isActive } = body

    if (!userId || !employeeCode || !designation) {
      return NextResponse.json({ error: 'User, employee code, and designation are required' }, { status: 400 })
    }

    // Check user exists
    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Check unique employee code
    const existingCode = await db.employee.findUnique({ where: { employeeCode } })
    if (existingCode) return NextResponse.json({ error: 'Employee code already exists' }, { status: 400 })

    // Check user not already linked
    const existingUserLink = await db.employee.findUnique({ where: { userId } })
    if (existingUserLink) return NextResponse.json({ error: 'User already linked to an employee' }, { status: 400 })

    const employee = await db.employee.create({
      data: {
        userId,
        employeeCode,
        designation,
        department: department || null,
        phone: phone || null,
        address: address || null,
        joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
        baseSalary: baseSalary || 0,
        bankAccount: bankAccount || null,
        bankName: bankName || null,
        bankIfsc: bankIfsc || null,
        panNumber: panNumber || null,
        aadhaarNumber: aadhaarNumber || null,
        isActive: isActive !== false,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    })

    await createAuditLog({
      userId: session.id,
      action: 'CREATE_EMPLOYEE',
      entityType: 'Employee',
      entityId: employee.id,
      newValues: JSON.stringify({ employeeCode: employee.employeeCode, designation: employee.designation, userId: employee.userId }),
    })

    return NextResponse.json({ employee }, { status: 201 })
  } catch (error) {
    console.error('POST /api/employees error:', error)
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 })
  }
}
