import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET() {
  try {
    const headers = [
      'Site Name',
      'Category Name',
      'Amount',
      'Description',
      'Expense Date',
      'Seller Name',
      'Invoice Number',
      'Payment Method',
      'Notes',
    ];

    const sampleRows = [
      [
        'Main Building Site',
        'Cement & Sand',
        5000,
        'Purchased 50 bags of cement',
        '15/01/2025',
        'ABC Traders',
        'INV-2025-001',
        'CASH',
        'Urgent delivery required',
      ],
      [
        'Office Renovation',
        'Electrical',
        3200,
        'Wiring materials for floor 2',
        '2025-01-18',
        'XYZ Electricals',
        'INV-2025-045',
        'UPI',
        '',
      ],
    ];

    const data = [headers, ...sampleRows];
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 22 }, // Site Name
      { wch: 18 }, // Category Name
      { wch: 12 }, // Amount
      { wch: 30 }, // Description
      { wch: 14 }, // Expense Date
      { wch: 18 }, // Seller Name
      { wch: 18 }, // Invoice Number
      { wch: 14 }, // Payment Method
      { wch: 25 }, // Notes
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses Template');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="expense-bulk-upload-template.xlsx"',
      },
    });
  } catch (error: unknown) {
    console.error('Generate expense template error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
