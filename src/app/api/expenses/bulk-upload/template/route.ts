import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import * as XLSX from 'xlsx'

// GET /api/expenses/bulk-upload/template — generate xlsx template
export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create template workbook
    const headers = [
      'siteName', 'categoryName', 'description', 'amount', 'expenseDate',
      'paymentMethod', 'sellerName', 'invoiceNumber', 'notes', 'userId',
    ]

    const sampleData = [
      ['Main Site', 'Electrical', 'Wire purchase', 5000, '2025-01-15', 'CASH', 'ABC Traders', 'INV-001', 'Monthly purchase', ''],
      ['Branch Office', 'Plumbing', 'Pipe fittings', 3200, '2025-01-16', 'UPI', 'XYZ Hardware', 'INV-002', '', ''],
    ]

    const wsData = [headers, ...sampleData]
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Set column widths
    ws['!cols'] = [
      { wch: 20 }, // siteName
      { wch: 15 }, // categoryName
      { wch: 30 }, // description
      { wch: 12 }, // amount
      { wch: 15 }, // expenseDate (YYYY-MM-DD)
      { wch: 15 }, // paymentMethod (CASH/UPI/CREDIT/OFFICE)
      { wch: 20 }, // sellerName
      { wch: 15 }, // invoiceNumber
      { wch: 30 }, // notes
      { wch: 30 }, // userId (optional)
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="expense-bulk-upload-template.xlsx"',
      },
    })
  } catch (error) {
    console.error('GET /api/expenses/bulk-upload/template error:', error)
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 })
  }
}
