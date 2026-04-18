import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog, formatAuditValues } from '@/lib/audit';
import { PaymentMethod } from '@prisma/client';
import * as XLSX from 'xlsx';

const MAX_ROWS = 500;

// Normalize header name: lowercase, trim, replace spaces with underscores
function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/\s+/g, '_');
}

// Column mapping: normalized header -> internal field
const EXPENSE_COLUMNS: Record<string, string> = {
  site_name: 'siteName',
  category_name: 'categoryName',
  amount: 'amount',
  description: 'description',
  expense_date: 'expenseDate',
  seller_name: 'sellerName',
  invoice_number: 'invoiceNumber',
  payment_method: 'paymentMethod',
  notes: 'notes',
};

const REQUIRED_COLUMNS = ['siteName', 'categoryName', 'amount', 'description', 'expenseDate'];

function parseExpenseDate(value: unknown): Date | null {
  if (value == null) return null;
  const str = String(value).trim();
  if (!str) return null;

  // Try DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(date.getTime())) return date;
  }

  // Try YYYY-MM-DD or any ISO-like format
  const isoDate = new Date(str);
  if (!isNaN(isoDate.getTime())) return isoDate;

  return null;
}

function parsePaymentMethod(value: unknown): PaymentMethod | null {
  if (value == null) return null;
  const str = String(value).trim().toUpperCase();
  if (Object.values(PaymentMethod).includes(str as PaymentMethod)) {
    return str as PaymentMethod;
  }
  return null;
}

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
      if (EXPENSE_COLUMNS[normalized]) {
        headerMap[header] = EXPENSE_COLUMNS[normalized];
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

    // Pre-fetch all sites and categories for lookup
    const [allSites, allCategories] = await Promise.all([
      db.site.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
      db.category.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    ]);

    const siteMap = new Map(allSites.map((s) => [s.name.toLowerCase(), s.id]));
    const categoryMap = new Map(allCategories.map((c) => [c.name.toLowerCase(), c.id]));

    // Process rows
    const errors: { row: number; error: string }[] = [];
    const validExpenses: {
      siteId: string;
      categoryId: string;
      amount: number;
      description: string;
      expenseDate: Date;
      sellerName: string | null;
      invoiceNumber: string | null;
      paymentMethod: PaymentMethod;
      notes: string | null;
      isLateSubmission: boolean;
      daysLate: number;
    }[] = [];

    const submissionDate = new Date();

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

      // Validate category name
      const categoryName = String(row.categoryName).trim();
      const categoryId = categoryMap.get(categoryName.toLowerCase());
      if (!categoryId) {
        errors.push({ row: rowNum, error: `Category "${categoryName}" not found in database` });
        continue;
      }

      // Validate amount
      const amount = parseAmount(row.amount);
      if (amount === null || amount <= 0) {
        errors.push({ row: rowNum, error: 'Amount must be a positive number' });
        continue;
      }

      // Validate expense date
      const expenseDate = parseExpenseDate(row.expenseDate);
      if (!expenseDate) {
        errors.push({
          row: rowNum,
          error: `Invalid date "${row.expenseDate}". Use DD/MM/YYYY or YYYY-MM-DD format.`,
        });
        continue;
      }

      // Validate payment method (optional, default CASH)
      let paymentMethod: PaymentMethod = PaymentMethod.CASH;
      if (row.paymentMethod != null && String(row.paymentMethod).trim() !== '') {
        const parsed = parsePaymentMethod(row.paymentMethod);
        if (!parsed) {
          errors.push({
            row: rowNum,
            error: `Invalid payment method "${row.paymentMethod}". Must be one of: CASH, UPI, CREDIT, OFFICE.`,
          });
          continue;
        }
        paymentMethod = parsed;
      }

      // Calculate late submission
      const daysDiff = Math.floor(
        (submissionDate.getTime() - expenseDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const isLateSubmission = daysDiff > 3;
      const daysLate = isLateSubmission ? daysDiff : 0;

      validExpenses.push({
        siteId,
        categoryId,
        amount,
        description: String(row.description).trim(),
        expenseDate,
        sellerName: row.sellerName ? String(row.sellerName).trim() : null,
        invoiceNumber: row.invoiceNumber ? String(row.invoiceNumber).trim() : null,
        paymentMethod,
        notes: row.notes ? String(row.notes).trim() : null,
        isLateSubmission,
        daysLate,
      });
    }

    if (validExpenses.length === 0) {
      return NextResponse.json({
        success: false,
        created: 0,
        errors,
      });
    }

    // Create all expenses in a transaction
    const createdExpenses = await db.$transaction(
      validExpenses.map((expense) =>
        db.expense.create({
          data: {
            siteId: expense.siteId,
            categoryId: expense.categoryId,
            userId: session.id,
            amount: expense.amount,
            description: expense.description,
            expenseDate: expense.expenseDate,
            submissionDate,
            sellerName: expense.sellerName,
            invoiceNumber: expense.invoiceNumber,
            paymentMethod: expense.paymentMethod,
            notes: expense.notes,
            isLateSubmission: expense.isLateSubmission,
            daysLate: expense.daysLate,
          },
        })
      )
    );

    // Create audit logs for each created expense
    await Promise.all(
      createdExpenses.map((expense, index) =>
        createAuditLog({
          userId: session.id,
          action: 'BULK_UPLOAD_EXPENSE',
          entityType: 'EXPENSE',
          entityId: expense.id,
          newValues: formatAuditValues({
            siteId: validExpenses[index].siteId,
            categoryId: validExpenses[index].categoryId,
            amount: validExpenses[index].amount,
            description: validExpenses[index].description,
            expenseDate: validExpenses[index].expenseDate.toISOString(),
            paymentMethod: validExpenses[index].paymentMethod,
            isLateSubmission: validExpenses[index].isLateSubmission,
            daysLate: validExpenses[index].daysLate,
          }),
        })
      )
    );

    return NextResponse.json({
      success: true,
      created: createdExpenses.length,
      errors,
    });
  } catch (error: unknown) {
    console.error('Bulk upload expenses error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
