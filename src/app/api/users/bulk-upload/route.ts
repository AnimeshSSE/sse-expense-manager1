import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission, hashPassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog, formatAuditValues } from '@/lib/audit';
import { Role } from '@prisma/client';
import * as XLSX from 'xlsx';

const MAX_ROWS = 500;

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/\s+/g, '_');
}

const USER_COLUMNS: Record<string, string> = {
  name: 'name',
  email: 'email',
  password: 'password',
  role: 'role',
};

const REQUIRED_COLUMNS = ['name', 'email', 'password', 'role'];

const VALID_ROLES: Role[] = [Role.ADMIN, Role.ACCOUNTANT, Role.STOCK_MANAGER, Role.USER];

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!checkPermission(session.role, 'MANAGE_USERS')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileName = file.name.toLowerCase();
    const hasValidExt = validExtensions.some((ext) => fileName.endsWith(ext));
    if (!hasValidExt) {
      return NextResponse.json(
        { error: 'Invalid file type. Only xlsx, xls, and csv files are accepted.' },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    if (rawRows.length === 0) {
      return NextResponse.json({ error: 'File is empty or has no data rows.' }, { status: 400 });
    }

    if (rawRows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `File exceeds maximum of ${MAX_ROWS} rows. Found ${rawRows.length} rows.` },
        { status: 400 }
      );
    }

    // Build header mapping from actual file headers
    const actualHeaders = Object.keys(rawRows[0]);
    const headerMap: Record<string, string> = {};
    for (const header of actualHeaders) {
      const normalized = normalizeHeader(header);
      if (USER_COLUMNS[normalized]) {
        headerMap[header] = USER_COLUMNS[normalized];
      }
    }

    // Validate required columns exist
    const mappedFields = new Set(Object.values(headerMap));
    const missingColumns = REQUIRED_COLUMNS.filter((col) => !mappedFields.has(col));
    if (missingColumns.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required columns: ${missingColumns.join(', ')}. Please ensure your file has the correct headers.`,
        },
        { status: 400 }
      );
    }

    // Pre-fetch existing user emails for duplicate check
    const existingUsers = await db.user.findMany({
      select: { email: true },
    });
    const existingEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));

    // Process rows
    const errors: { row: number; error: string }[] = [];
    const validUsers: { name: string; email: string; password: string; role: Role }[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const rowNum = i + 2;
      const raw = rawRows[i];

      // Map raw row to internal fields
      const row: Record<string, unknown> = {};
      for (const [header, field] of Object.entries(headerMap)) {
        row[field] = raw[header];
      }

      // Validate required fields
      const name = row.name != null ? String(row.name).trim() : '';
      if (!name) {
        errors.push({ row: rowNum, error: 'Missing required field: name' });
        continue;
      }

      const email = row.email != null ? String(row.email).trim().toLowerCase() : '';
      if (!email) {
        errors.push({ row: rowNum, error: 'Missing required field: email' });
        continue;
      }

      // Basic email format validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({ row: rowNum, error: `Invalid email format: "${email}"` });
        continue;
      }

      const password = row.password != null ? String(row.password) : '';
      if (!password) {
        errors.push({ row: rowNum, error: 'Missing required field: password' });
        continue;
      }

      const roleStr = row.role != null ? String(row.role).trim().toUpperCase() : '';
      if (!roleStr) {
        errors.push({ row: rowNum, error: 'Missing required field: role' });
        continue;
      }

      if (!VALID_ROLES.includes(roleStr as Role)) {
        errors.push({
          row: rowNum,
          error: `Invalid role "${row.role}". Must be one of: ADMIN, ACCOUNTANT, STOCK_MANAGER, USER`,
        });
        continue;
      }

      // Check for duplicate email
      if (existingEmails.has(email)) {
        errors.push({ row: rowNum, error: `User with email "${email}" already exists` });
        continue;
      }

      validUsers.push({
        name,
        email,
        password,
        role: roleStr as Role,
      });
      existingEmails.add(email); // Prevent duplicates within the same upload
    }

    if (validUsers.length === 0) {
      return NextResponse.json({
        created: 0,
        errors,
      });
    }

    // Hash passwords and create all users
    const usersToCreate = await Promise.all(
      validUsers.map(async (user) => ({
        name: user.name,
        email: user.email,
        password: await hashPassword(user.password),
        role: user.role,
      }))
    );

    const createdUsers = await db.user.createMany({
      data: usersToCreate,
    });

    // Create audit log (excluding sensitive password data)
    await createAuditLog({
      userId: session.id,
      action: 'BULK_UPLOAD_USERS',
      entityType: 'USER',
      newValues: formatAuditValues({
        count: createdUsers.count,
        users: validUsers.map((u) => ({ name: u.name, email: u.email, role: u.role })),
      }),
    });

    return NextResponse.json({
      created: createdUsers.count,
      errors,
    });
  } catch (error: unknown) {
    console.error('Bulk upload users error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
