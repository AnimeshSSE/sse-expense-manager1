import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog, formatAuditValues } from '@/lib/audit';
import { Role } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');
    const designation = searchParams.get('designation');
    const active = searchParams.get('active');

    const isAdminOrAccountant = session.role === 'ADMIN' || session.role === 'ACCOUNTANT';

    const where: any = {};
    if (!isAdminOrAccountant) {
      where.userId = session.id;
    }
    if (department) where.department = department;
    if (designation) where.designation = designation;
    if (active !== null && active !== undefined && active !== '') {
      where.isActive = active === 'true';
    }

    const employees = await db.employee.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true, isActive: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ employees });
  } catch (error: any) {
    console.error('Get employees error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admin can create employees' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, employeeCode, designation, baseSalary, department, phone, address, joiningDate, bankAccount, bankName, bankIfsc, panNumber, aadhaarNumber } = body;

    if (!userId || !designation) {
      return NextResponse.json({ error: 'User ID and designation are required' }, { status: 400 });
    }

    const userExists = await db.user.findUnique({ where: { id: userId } });
    if (!userExists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const existingEmployee = await db.employee.findUnique({ where: { userId } });
    if (existingEmployee) {
      return NextResponse.json({ error: 'Employee record already exists for this user' }, { status: 409 });
    }

    let code = employeeCode;
    if (!code) {
      const lastEmployee = await db.employee.findFirst({
        orderBy: { employeeCode: 'desc' },
        select: { employeeCode: true },
      });
      let nextNum = 1;
      if (lastEmployee?.employeeCode) {
        const match = lastEmployee.employeeCode.match(/SSE-(\d+)/);
        if (match) nextNum = parseInt(match[1]) + 1;
      }
      code = `SSE-${String(nextNum).padStart(3, '0')}`;
    }

    // Check uniqueness of employeeCode
    const existingCode = await db.employee.findUnique({ where: { employeeCode: code } });
    if (existingCode) {
      return NextResponse.json({ error: 'Employee code already in use' }, { status: 409 });
    }

    const employee = await db.employee.create({
      data: {
        userId,
        employeeCode: code,
        designation,
        baseSalary: baseSalary ? parseFloat(baseSalary) : 0,
        department: department || null,
        phone: phone || null,
        address: address || null,
        joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
        bankAccount: bankAccount || null,
        bankName: bankName || null,
        bankIfsc: bankIfsc || null,
        panNumber: panNumber || null,
        aadhaarNumber: aadhaarNumber || null,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
      },
    });

    await createAuditLog({
      userId: session.id,
      action: 'CREATE_EMPLOYEE',
      entityType: 'EMPLOYEE',
      entityId: employee.id,
      newValues: formatAuditValues({ userId, employeeCode: code, designation, baseSalary }),
    });

    return NextResponse.json({ employee }, { status: 201 });
  } catch (error: any) {
    console.error('Create employee error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
