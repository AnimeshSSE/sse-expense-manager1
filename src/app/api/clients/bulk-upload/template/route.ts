import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET() {
  try {
    const headers = ['Name', 'Description'];

    const sampleRows = [
      ['SS Electricals', 'Electrical contractor for commercial projects'],
      ['ABC Builders', 'Construction company'],
      ['City Developers', 'Real estate developer'],
    ];

    const data = [headers, ...sampleRows];
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    worksheet['!cols'] = [
      { wch: 25 }, // Name
      { wch: 45 }, // Description
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clients Template');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="clients-template.xlsx"',
      },
    });
  } catch (error: unknown) {
    console.error('Generate clients template error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
