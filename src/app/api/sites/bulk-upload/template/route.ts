import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET() {
  try {
    const headers = ['Name', 'Client Name', 'Location', 'Description', 'Budget'];

    const sampleRows = [
      ['Main Building Site', 'SS Electricals', 'Downtown Area', 'Primary construction site', 500000],
      ['Office Renovation', 'ABC Builders', 'Business District', 'Office floor renovation', 150000],
      ['Warehouse Project', 'City Developers', 'Industrial Zone', 'Warehouse construction', 800000],
    ];

    const data = [headers, ...sampleRows];
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    worksheet['!cols'] = [
      { wch: 25 }, // Name
      { wch: 20 }, // Client Name
      { wch: 20 }, // Location
      { wch: 30 }, // Description
      { wch: 15 }, // Budget
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sites Template');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="sites-template.xlsx"',
      },
    });
  } catch (error: unknown) {
    console.error('Generate sites template error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
