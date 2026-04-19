import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog, formatAuditValues } from '@/lib/audit';
import * as XLSX from 'xlsx';

const MAX_ROWS = 500;

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/\s+/g, '_');
}

const SITE_COLUMNS: Record<string, string> = {
  name: 'name',
  client_name: 'clientName',
  clientname: 'clientName',
  location: 'location',
  description: 'description',
  budget: 'budget',
};

const REQUIRED_COLUMNS = ['name', 'clientName'];

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!checkPermission(session.role, 'MANAGE_SITES')) {
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
      if (SITE_COLUMNS[normalized]) {
        headerMap[header] = SITE_COLUMNS[normalized];
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

    // Pre-fetch all active clients for lookup
    const allClients = await db.client.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });
    const clientMap = new Map(allClients.map((c) => [c.name.toLowerCase(), c.id]));

    // Process rows
    const errors: { row: number; error: string }[] = [];
    const validSites: { name: string; clientId: string; location: string | null; description: string | null; budget: number }[] = [];

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

      const clientName = row.clientName != null ? String(row.clientName).trim() : '';
      if (!clientName) {
        errors.push({ row: rowNum, error: 'Missing required field: clientName' });
        continue;
      }

      // Look up client by name
      const clientId = clientMap.get(clientName.toLowerCase());
      if (!clientId) {
        errors.push({ row: rowNum, error: `Client "${clientName}" not found in database` });
        continue;
      }

      // Parse optional budget
      let budget = 0;
      if (row.budget != null && String(row.budget).trim() !== '') {
        const parsed = typeof row.budget === 'number' ? row.budget : parseFloat(String(row.budget).replace(/,/g, ''));
        if (isNaN(parsed) || parsed < 0) {
          errors.push({ row: rowNum, error: `Invalid budget "${row.budget}". Must be a non-negative number.` });
          continue;
        }
        budget = parsed;
      }

      const location = row.location ? String(row.location).trim() : null;
      const description = row.description ? String(row.description).trim() : null;

      validSites.push({ name, clientId, location, description, budget });
    }

    if (validSites.length === 0) {
      return NextResponse.json({
        created: 0,
        errors,
      });
    }

    // Create all sites
    const createdSites = await db.site.createMany({
      data: validSites.map((site) => ({
        name: site.name,
        clientId: site.clientId,
        location: site.location,
        description: site.description,
        budget: site.budget,
      })),
    });

    // Create audit log
    await createAuditLog({
      userId: session.id,
      action: 'BULK_UPLOAD_SITES',
      entityType: 'SITE',
      newValues: formatAuditValues({
        count: createdSites.count,
        sites: validSites.map((s) => ({ name: s.name, clientName: s.clientId })),
      }),
    });

    return NextResponse.json({
      created: createdSites.count,
      errors,
    });
  } catch (error: unknown) {
    console.error('Bulk upload sites error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
