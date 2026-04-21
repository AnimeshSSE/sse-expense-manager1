import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog, formatAuditValues } from '@/lib/audit';
import { CategoryType } from '@/lib/prisma-constants';
import * as XLSX from 'xlsx';

const MAX_ROWS = 500;

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/\s+/g, '_');
}

const CATEGORY_COLUMNS: Record<string, string> = {
  name: 'name',
  type: 'type',
  description: 'description',
};

const REQUIRED_COLUMNS = ['name'];

const VALID_TYPES: CategoryType[] = [CategoryType.EXPENSE, CategoryType.REQUISITION, CategoryType.BOTH];

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!checkPermission(session.role, 'MANAGE_CATEGORIES')) {
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
      if (CATEGORY_COLUMNS[normalized]) {
        headerMap[header] = CATEGORY_COLUMNS[normalized];
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

    // Pre-fetch existing category names for duplicate check
    const existingCategories = await db.category.findMany({
      select: { name: true },
    });
    const existingNames = new Set(existingCategories.map((c) => c.name.toLowerCase()));

    // Process rows
    const errors: { row: number; error: string }[] = [];
    const validCategories: { name: string; type: CategoryType; description: string | null }[] = [];

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

      // Check for duplicates
      if (existingNames.has(name.toLowerCase())) {
        errors.push({ row: rowNum, error: `Category "${name}" already exists` });
        continue;
      }

      // Parse optional type (defaults to BOTH)
      let type: CategoryType = CategoryType.BOTH;
      if (row.type != null && String(row.type).trim() !== '') {
        const typeStr = String(row.type).trim().toUpperCase();
        if (!VALID_TYPES.includes(typeStr as CategoryType)) {
          errors.push({
            row: rowNum,
            error: `Invalid type "${row.type}". Must be one of: EXPENSE, REQUISITION, BOTH`,
          });
          continue;
        }
        type = typeStr as CategoryType;
      }

      const description = row.description ? String(row.description).trim() : null;

      validCategories.push({ name, type, description });
      existingNames.add(name.toLowerCase()); // Prevent duplicates within the same upload
    }

    if (validCategories.length === 0) {
      return NextResponse.json({
        created: 0,
        errors,
      });
    }

    // Create all categories
    const createdCategories = await db.category.createMany({
      data: validCategories.map((category) => ({
        name: category.name,
        type: category.type,
        description: category.description,
      })),
    });

    // Create audit log
    await createAuditLog({
      userId: session.id,
      action: 'BULK_UPLOAD_CATEGORIES',
      entityType: 'CATEGORY',
      newValues: formatAuditValues({
        count: createdCategories.count,
        names: validCategories.map((c) => c.name),
      }),
    });

    return NextResponse.json({
      created: createdCategories.count,
      errors,
    });
  } catch (error: unknown) {
    console.error('Bulk upload categories error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
