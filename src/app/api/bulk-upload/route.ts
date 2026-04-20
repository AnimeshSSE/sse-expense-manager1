import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'
import { hashPassword } from '@/lib/auth'
import { CategoryType, Role } from '@/lib/prisma-constants'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!checkPermission(session.role, 'MANAGE_DATA')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const type = formData.get('type') as string

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    const validTypes = ['clients', 'sites', 'categories', 'users']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` }, { status: 400 })
    }

    // Parse file
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx')
    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[]

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 })
    }

    const success: string[] = []
    const errors: string[] = []

    switch (type) {
      case 'clients': {
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]
          const name = String(row.name || '').trim()
          if (!name) {
            errors.push(`Row ${i + 2}: name is required`)
            continue
          }
          // Check if client with same name exists
          const existing = await db.client.findFirst({ where: { name } })
          if (existing) {
            errors.push(`Row ${i + 2}: Client "${name}" already exists`)
            continue
          }
          const description = String(row.description || '').trim() || null
          await db.client.create({ data: { name, description } })
          success.push(`Row ${i + 2}: Client "${name}" created`)
        }
        break
      }

      case 'sites': {
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]
          const name = String(row.name || '').trim()
          const clientName = String(row.clientName || '').trim()
          if (!name || !clientName) {
            errors.push(`Row ${i + 2}: name and clientName are required`)
            continue
          }
          // Check if site with same name exists
          const existing = await db.site.findFirst({ where: { name } })
          if (existing) {
            errors.push(`Row ${i + 2}: Site "${name}" already exists`)
            continue
          }
          // Find client by name
          const client = await db.client.findFirst({ where: { name: clientName } })
          if (!client) {
            errors.push(`Row ${i + 2}: Client "${clientName}" not found`)
            continue
          }
          const location = String(row.location || '').trim() || null
          const description = String(row.description || '').trim() || null
          const budget = parseFloat(String(row.budget || '0')) || 0
          await db.site.create({
            data: { name, clientId: client.id, location, description, budget },
          })
          success.push(`Row ${i + 2}: Site "${name}" created`)
        }
        break
      }

      case 'categories': {
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]
          const name = String(row.name || '').trim()
          if (!name) {
            errors.push(`Row ${i + 2}: name is required`)
            continue
          }
          // Check if category with same name exists
          const existing = await db.category.findFirst({ where: { name } })
          if (existing) {
            errors.push(`Row ${i + 2}: Category "${name}" already exists`)
            continue
          }
          const typeStr = String(row.type || '').trim().toUpperCase()
          const validCategoryTypes = ['EXPENSE', 'REQUISITION', 'BOTH']
          const categoryType = validCategoryTypes.includes(typeStr) ? typeStr as CategoryType : CategoryType.BOTH
          const description = String(row.description || '').trim() || null
          await db.category.create({ data: { name, type: categoryType, description } })
          success.push(`Row ${i + 2}: Category "${name}" created`)
        }
        break
      }

      case 'users': {
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]
          const name = String(row.name || '').trim()
          const email = String(row.email || '').trim()
          const roleStr = String(row.role || '').trim().toUpperCase()
          const password = String(row.password || '').trim()
          if (!name || !email || !password) {
            errors.push(`Row ${i + 2}: name, email, and password are required`)
            continue
          }
          // Check if user with same email exists
          const existing = await db.user.findFirst({ where: { email } })
          if (existing) {
            errors.push(`Row ${i + 2}: User with email "${email}" already exists`)
            continue
          }
          const validRoles = ['ADMIN', 'ACCOUNTANT', 'STOCK_MANAGER', 'USER']
          const role = validRoles.includes(roleStr) ? roleStr as Role : Role.USER
          const hashedPassword = hashPassword(password)
          await db.user.create({ data: { name, email, password: hashedPassword, role } })
          success.push(`Row ${i + 2}: User "${name}" (${email}) created with role ${role}`)
        }
        break
      }
    }

    await createAuditLog({
      userId: session.id,
      action: `BULK_UPLOAD_${type.toUpperCase()}`,
      entityType: 'BULK_UPLOAD',
      newValues: `${success.length} created, ${errors.length} errors`,
    })

    return NextResponse.json({ success, errors })
  } catch (error) {
    console.error('Bulk Upload API error:', error)
    return NextResponse.json({ error: 'Failed to process bulk upload' }, { status: 500 })
  }
}
