import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET() {
  try {
    const headers = ['Site Name', 'Amount', 'Purpose', 'Notes'];

    const sampleRows = [
      [
        'Main Building Site',
        10000,
        'Site supervision advance for January',
        'Monthly advance request',
      ],
      [
        'Office Renovation',
        5000,
        'Material purchase advance',
        '',
      ],
    ];

    const data = [headers, ...sampleRows];
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 22 }, // Site Name
      { wch: 12 }, // Amount
      { wch: 35 }, // Purpose
      { wch: 25 }, // Notes
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Advances Template');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="advance-bulk-upload-template.xlsx"',
      },
    });
  } catch (error: unknown) {
    console.error('Generate advance template error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
