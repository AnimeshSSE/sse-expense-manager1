import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    // USER can only see their own employee
    if (!checkPermission(session.role, 'MANAGE_EMPLOYEES')) {
      const myEmployee = await db.employee.findUnique({ where: { userId: session.id } })
      if (!myEmployee || myEmployee.id !== id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const employee = await db.employee.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
      },
    })

    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

    return NextResponse.json({ employee })
  } catch (error) {
    console.error('GET /api/employees/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch employee' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!checkPermission(session.role, 'MANAGE_EMPLOYEES')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { employeeCode, designation, department, phone, address, joiningDate, baseSalary, bankAccount, bankName, bankIfsc, panNumber, aadhaarNumber, isActive } = body

    const existing = await db.employee.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

    if (employeeCode && employeeCode !== existing.employeeCode) {
      const codeTaken = await db.employee.findUnique({ where: { employeeCode } })
      if (codeTaken) {
        return NextResponse.json({ error: 'Employee code already exists' }, { status: 400 })
      }
    }

    const updateData: Record<string, unknown> = {}
    if (employeeCode !== undefined) updateData.employeeCode = employeeCode
    if (designation !== undefined) updateData.designation = designation
    if (department !== undefined) updateData.department = department || null
    if (phone !== undefined) updateData.phone = phone || null
    if (address !== undefined) updateData.address = address || null
    if (joiningDate !== undefined) updateData.joiningDate = joiningDate ? new Date(joiningDate) : new Date()
    if (baseSalary !== undefined) updateData.baseSalary = baseSalary
    if (bankAccount !== undefined) updateData.bankAccount = bankAccount || null
    if (bankName !== undefined) updateData.bankName = bankName || null
    if (bankIfsc !== undefined) updateData.bankIfsc = bankIfsc || null
    if (panNumber !== undefined) updateData.panNumber = panNumber || null
    if (aadhaarNumber !== undefined) updateData.aadhaarNumber = aadhaarNumber || null
    if (isActive !== undefined) updateData.isActive = isActive

    const oldValues = JSON.stringify({
      employeeCode: existing.employeeCode,
      designation: existing.designation,
      department: existing.department,
      baseSalary: existing.baseSalary,
      isActive: existing.isActive,
    })

    const employee = await db.employee.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    })

    await createAuditLog({
      userId: session.id,
      action: 'UPDATE_EMPLOYEE',
      entityType: 'Employee',
      entityId: id,
      oldValues,
      newValues: JSON.stringify({
        employeeCode: employee.employeeCode,
        designation: employee.designation,
        department: employee.department,
        baseSalary: employee.baseSalary,
        isActive: employee.isActive,
      }),
    })

    return NextResponse.json({ employee })
  } catch (error) {
    console.error('PUT /api/employees/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!checkPermission(session.role, 'MANAGE_EMPLOYEES')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const existing = await db.employee.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

    // Delete leaves first (cascade should handle this, but be explicit)
    await db.leave.deleteMany({ where: { employeeId: id } })

    await db.employee.delete({ where: { id } })

    await createAuditLog({
      userId: session.id,
      action: 'DELETE_EMPLOYEE',
      entityType: 'Employee',
      entityId: id,
      oldValues: JSON.stringify({ employeeCode: existing.employeeCode, designation: existing.designation }),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/employees/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 })
  }
}
