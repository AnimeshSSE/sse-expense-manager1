import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

// GET /api/advances/bulk-upload/template — generate xlsx template
export async function GET() {
  try {
    const headers = ['siteName', 'amount', 'purpose', 'notes', 'paymentDate']
    const exampleRow = ['Site A', 5000, 'Material purchase', 'Optional notes', '2025-01-15']

    const worksheetData = [headers, exampleRow]
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

    // Set column widths
    worksheet['!cols'] = [
      { wch: 25 }, // siteName
      { wch: 15 }, // amount
      { wch: 35 }, // purpose
      { wch: 30 }, // notes
      { wch: 15 }, // paymentDate
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Advances Template')

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="advances-template.xlsx"',
      },
    })
  } catch (error) {
    console.error('GET /api/advances/bulk-upload/template error:', error)
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 })
  }
}
