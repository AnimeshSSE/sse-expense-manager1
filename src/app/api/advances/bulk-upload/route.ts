import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'
import * as XLSX from 'xlsx'

// POST /api/advances/bulk-upload — parse xlsx/csv and create advances
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet)

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Empty file or no data rows' }, { status: 400 })
    }

    // Pre-fetch all sites for matching
    const allSites = await db.site.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    })

    const siteMap = new Map<string, string>()
    for (const site of allSites) {
      siteMap.set(site.name.toLowerCase().trim(), site.id)
    }

    const errors: { row: number; message: string }[] = []
    const successCount = { value: 0 }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNumber = i + 2 // 1-based, skip header

      const siteName = (row.siteName || '').toString().trim()
      const amount = parseFloat(row.amount)
      const purpose = (row.purpose || '').toString().trim()
      const notes = (row.notes || '').toString().trim()

      if (!siteName) {
        errors.push({ row: rowNumber, message: 'Missing site name' })
        continue
      }

      if (!amount || amount <= 0 || isNaN(amount)) {
        errors.push({ row: rowNumber, message: 'Invalid or missing amount' })
        continue
      }

      if (!purpose) {
        errors.push({ row: rowNumber, message: 'Missing purpose' })
        continue
      }

      const siteId = siteMap.get(siteName.toLowerCase())
      if (!siteId) {
        errors.push({ row: rowNumber, message: `Site "${siteName}" not found` })
        continue
      }

      try {
        await db.advance.create({
          data: {
            userId: session.id,
            siteId,
            amount,
            purpose,
            notes: notes || null,
            status: 'PENDING',
          },
        })
        successCount.value++
      } catch (err: any) {
        errors.push({ row: rowNumber, message: err.message || 'Failed to create advance' })
      }
    }

    await createAuditLog({
      userId: session.id,
      action: 'BULK_UPLOAD_ADVANCES',
      entityType: 'Advance',
      newValues: JSON.stringify({ total: rows.length, success: successCount.value, errors: errors.length }),
    })

    return NextResponse.json({
      success: true,
      total: rows.length,
      created: successCount.value,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('POST /api/advances/bulk-upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
