import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET() {
  try {
    const headers = ['Name', 'Type', 'Description'];

    const sampleRows = [
      ['Cement & Sand', 'EXPENSE', 'Construction material expenses'],
      ['Electrical Supplies', 'REQUISITION', 'Electrical materials requisition'],
      ['Plumbing', 'BOTH', 'Plumbing materials for expenses and requisitions'],
      ['Paint & Finish', 'EXPENSE', 'Painting and finishing expenses'],
    ];

    const data = [headers, ...sampleRows];
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    worksheet['!cols'] = [
      { wch: 25 }, // Name
      { wch: 15 }, // Type
      { wch: 45 }, // Description
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Categories Template');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="categories-template.xlsx"',
      },
    });
  } catch (error: unknown) {
    console.error('Generate categories template error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
