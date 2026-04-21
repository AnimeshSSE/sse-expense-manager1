import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog, formatAuditValues } from '@/lib/audit';
import * as XLSX from 'xlsx';

const MAX_ROWS = 500;

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/\s+/g, '_');
}

const CLIENT_COLUMNS: Record<string, string> = {
  name: 'name',
  description: 'description',
};

const REQUIRED_COLUMNS = ['name'];

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!checkPermission(session.role, 'MANAGE_CLIENTS')) {
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
      if (CLIENT_COLUMNS[normalized]) {
        headerMap[header] = CLIENT_COLUMNS[normalized];
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

    // Pre-fetch existing client names for duplicate check
    const existingClients = await db.client.findMany({
      select: { name: true },
    });
    const existingNames = new Set(existingClients.map((c) => c.name.toLowerCase()));

    // Process rows
    const errors: { row: number; error: string }[] = [];
    const validClients: { name: string; description: string | null }[] = [];

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
        errors.push({ row: rowNum, error: `Client "${name}" already exists` });
        continue;
      }

      const description = row.description ? String(row.description).trim() : null;

      validClients.push({ name, description });
      existingNames.add(name.toLowerCase()); // Prevent duplicates within the same upload
    }

    if (validClients.length === 0) {
      return NextResponse.json({
        created: 0,
        errors,
      });
    }

    // Create all clients
    const createdClients = await db.client.createMany({
      data: validClients.map((client) => ({
        name: client.name,
        description: client.description,
      })),
    });

    // Create audit log
    await createAuditLog({
      userId: session.id,
      action: 'BULK_UPLOAD_CLIENTS',
      entityType: 'CLIENT',
      newValues: formatAuditValues({
        count: createdClients.count,
        names: validClients.map((c) => c.name),
      }),
    });

    return NextResponse.json({
      created: createdClients.count,
      errors,
    });
  } catch (error: unknown) {
    console.error('Bulk upload clients error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
