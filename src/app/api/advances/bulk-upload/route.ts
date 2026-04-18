import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog, formatAuditValues } from '@/lib/audit';
import * as XLSX from 'xlsx';

const MAX_ROWS = 500;

// Normalize header name: lowercase, trim, replace spaces with underscores
function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/\s+/g, '_');
}

// Column mapping: normalized header -> internal field
const ADVANCE_COLUMNS: Record<string, string> = {
  site_name: 'siteName',
  amount: 'amount',
  purpose: 'purpose',
  notes: 'notes',
};

const REQUIRED_COLUMNS = ['siteName', 'amount', 'purpose'];

function parseAmount(value: unknown): number | null {
  if (value == null) return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
  return isNaN(num) ? null : num;
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
      if (ADVANCE_COLUMNS[normalized]) {
        headerMap[header] = ADVANCE_COLUMNS[normalized];
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

    // Pre-fetch all sites for lookup
    const allSites = await db.site.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    const siteMap = new Map(allSites.map((s) => [s.name.toLowerCase(), s.id]));

    // Process rows
    const errors: { row: number; error: string }[] = [];
    const validAdvances: {
      siteId: string;
      amount: number;
      purpose: string;
      notes: string | null;
    }[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const rowNum = i + 2; // Excel row numbers start at 1, +1 for header
      const raw = rawRows[i];

      // Map raw row to internal fields
      const row: Record<string, unknown> = {};
      for (const [header, field] of Object.entries(headerMap)) {
        row[field] = raw[header];
      }

      // Validate required fields
      const missing = REQUIRED_COLUMNS.filter((col) => {
        const val = row[col];
        return val == null || String(val).trim() === '';
      });

      if (missing.length > 0) {
        errors.push({ row: rowNum, error: `Missing required fields: ${missing.join(', ')}` });
        continue;
      }

      // Validate site name
      const siteName = String(row.siteName).trim();
      const siteId = siteMap.get(siteName.toLowerCase());
      if (!siteId) {
        errors.push({ row: rowNum, error: `Site "${siteName}" not found in database` });
        continue;
      }

      // Validate amount
      const amount = parseAmount(row.amount);
      if (amount === null || amount <= 0) {
        errors.push({ row: rowNum, error: 'Amount must be a positive number' });
        continue;
      }

      validAdvances.push({
        siteId,
        amount,
        purpose: String(row.purpose).trim(),
        notes: row.notes ? String(row.notes).trim() : null,
      });
    }

    if (validAdvances.length === 0) {
      return NextResponse.json({
        success: false,
        created: 0,
        errors,
      });
    }

    // Create all advances in a transaction
    const createdAdvances = await db.$transaction(
      validAdvances.map((advance) =>
        db.advance.create({
          data: {
            userId: session.id,
            siteId: advance.siteId,
            amount: advance.amount,
            purpose: advance.purpose,
            notes: advance.notes,
          },
        })
      )
    );

    // Create audit logs for each created advance
    await Promise.all(
      createdAdvances.map((advance, index) =>
        createAuditLog({
          userId: session.id,
          action: 'BULK_UPLOAD_ADVANCE',
          entityType: 'ADVANCE',
          entityId: advance.id,
          newValues: formatAuditValues({
            siteId: validAdvances[index].siteId,
            amount: validAdvances[index].amount,
            purpose: validAdvances[index].purpose,
          }),
        })
      )
    );

    return NextResponse.json({
      success: true,
      created: createdAdvances.length,
      errors,
    });
  } catch (error: unknown) {
    console.error('Bulk upload advances error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
