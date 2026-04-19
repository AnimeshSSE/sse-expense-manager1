import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET() {
  try {
    const headers = ['Name', 'Email', 'Password', 'Role'];

    const sampleRows = [
      ['John Doe', 'john@example.com', 'securepassword123', 'USER'],
      ['Jane Smith', 'jane@example.com', 'securepassword456', 'ACCOUNTANT'],
      ['Bob Admin', 'bob@example.com', 'adminpass789', 'ADMIN'],
      ['Stock Manager', 'stock@example.com', 'stockpass321', 'STOCK_MANAGER'],
    ];

    const data = [headers, ...sampleRows];
    const worksheet = XLSX.utils.aoa_to_sheet(data);

    worksheet['!cols'] = [
      { wch: 20 }, // Name
      { wch: 28 }, // Email
      { wch: 22 }, // Password
      { wch: 16 }, // Role
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users Template');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="users-template.xlsx"',
      },
    });
  } catch (error: unknown) {
    console.error('Generate users template error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
