import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'
import { PaymentMethod } from '@/lib/prisma-constants'
import * as XLSX from 'xlsx'

// POST /api/expenses/bulk-upload
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Any authenticated user can bulk upload
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let workbook: XLSX.WorkBook

    const fileName = file.name.toLowerCase()
    if (fileName.endsWith('.csv')) {
      workbook = XLSX.read(buffer, { type: 'buffer' })
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      workbook = XLSX.read(buffer, { type: 'buffer' })
    } else {
      return NextResponse.json({ error: 'Invalid file format. Use .xlsx or .csv' }, { status: 400 })
    }

    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 })
    }

    // Pre-load sites and categories for matching
    const sites = await db.site.findMany({ include: { client: true } })
    const categories = await db.category.findMany()

    const siteMap = new Map<string, string>() // name -> id
    for (const s of sites) {
      siteMap.set(s.name.toLowerCase().trim(), s.id)
    }

    const categoryMap = new Map<string, string>() // name -> id
    for (const c of categories) {
      categoryMap.set(c.name.toLowerCase().trim(), c.id)
    }

    const validPaymentMethods = Object.values(PaymentMethod)

    const errors: { row: number; field: string; message: string }[] = []
    const created: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // 1-indexed, skip header

      try {
        // Validate required columns
        const siteName = String(row.siteName || '').trim()
        const categoryName = String(row.categoryName || '').trim()
        const description = String(row.description || '').trim()
        const amountRaw = row.amount
        const expenseDateRaw = row.expenseDate
        const paymentMethodRaw = String(row.paymentMethod || 'CASH').trim().toUpperCase()

        if (!siteName) { errors.push({ row: rowNum, field: 'siteName', message: 'Site name is required' }); continue }
        if (!categoryName) { errors.push({ row: rowNum, field: 'categoryName', message: 'Category name is required' }); continue }
        if (!description) { errors.push({ row: rowNum, field: 'description', message: 'Description is required' }); continue }
        if (!amountRaw || isNaN(Number(amountRaw)) || Number(amountRaw) <= 0) {
          errors.push({ row: rowNum, field: 'amount', message: 'Valid positive amount is required' }); continue
        }
        if (!expenseDateRaw) { errors.push({ row: rowNum, field: 'expenseDate', message: 'Expense date is required' }); continue }

        // Match site
        const siteId = siteMap.get(siteName.toLowerCase())
        if (!siteId) { errors.push({ row: rowNum, field: 'siteName', message: `Site "${siteName}" not found` }); continue }

        // Match category
        const categoryId = categoryMap.get(categoryName.toLowerCase())
        if (!categoryId) { errors.push({ row: rowNum, field: 'categoryName', message: `Category "${categoryName}" not found` }); continue }

        // Validate payment method
        let paymentMethod: PaymentMethod = PaymentMethod.CASH
        if (validPaymentMethods.includes(paymentMethodRaw as PaymentMethod)) {
          paymentMethod = paymentMethodRaw as PaymentMethod
        } else if (paymentMethodRaw !== '') {
          errors.push({ row: rowNum, field: 'paymentMethod', message: `Invalid payment method: ${paymentMethodRaw}` }); continue
        }

        // Parse date
        let expenseDate: Date
        if (typeof expenseDateRaw === 'number') {
          // Excel serial date
          expenseDate = new Date((expenseDateRaw - 25569) * 86400 * 1000)
        } else {
          expenseDate = new Date(String(expenseDateRaw))
          if (isNaN(expenseDate.getTime())) {
            errors.push({ row: rowNum, field: 'expenseDate', message: 'Invalid date format' }); continue
          }
        }

        // Calculate late submission
        const now = new Date()
        const diffMs = now.getTime() - expenseDate.getTime()
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
        const isLateSubmission = diffDays > 7
        const daysLate = isLateSubmission ? diffDays : 0

        // Determine userId
        let userId = session.id
        if (row.userId && checkPermission(session.role, 'VIEW_ALL_EXPENSES')) {
          const targetUser = await db.user.findUnique({ where: { id: String(row.userId) }, select: { id: true, isActive: true } })
          if (targetUser && targetUser.isActive) userId = targetUser.id
        }

        const expense = await db.expense.create({
          data: {
            siteId,
            categoryId,
            userId,
            amount: Number(amountRaw),
            description,
            expenseDate,
            paymentMethod,
            sellerName: String(row.sellerName || '').trim() || null,
            invoiceNumber: String(row.invoiceNumber || '').trim() || null,
            notes: String(row.notes || '').trim() || null,
            isLateSubmission,
            daysLate,
          },
        })

        created.push(expense.id)
      } catch (err) {
        errors.push({ row: rowNum, field: 'unknown', message: 'Unexpected error processing row' })
      }
    }

    await createAuditLog({
      userId: session.id,
      action: 'BULK_UPLOAD_EXPENSES',
      entityType: 'EXPENSE',
      newValues: JSON.stringify({ fileName: file.name, created: created.length, errors: errors.length }),
    })

    return NextResponse.json({
      success: created.length,
      errors,
      created,
    })
  } catch (error) {
    console.error('POST /api/expenses/bulk-upload error:', error)
    return NextResponse.json({ error: 'Failed to process bulk upload' }, { status: 500 })
  }
}
