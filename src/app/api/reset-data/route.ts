import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'
import { createAuditLog } from '@/lib/audit'

export async function POST() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!checkPermission(session.role, 'MANAGE_DATA')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete all data in correct order (respect foreign keys)
    // Comments must be deleted before expenses/requisitions/advances
    await db.comment.deleteMany()
    // BOQ items before requisitions
    await db.bOQItem.deleteMany()
    // Delete expenses, requisitions, advances
    await db.expense.deleteMany()
    await db.requisition.deleteMany()
    await db.advance.deleteMany()
    // Delete leaves (has FK to employee)
    await db.leave.deleteMany()
    // Delete employees
    await db.employee.deleteMany()
    // Delete audit logs
    await db.auditLog.deleteMany()
    // Delete sites, categories, clients
    await db.site.deleteMany()
    await db.category.deleteMany()
    await db.client.deleteMany()

    // Clear all user tokens (force re-login) but preserve User accounts
    await db.user.updateMany({
      data: { token: null, tokenExpiry: null },
    })

    // Create audit log for this action (after clearing other logs)
    await createAuditLog({
      userId: session.id,
      action: 'RESET_ALL_DATA',
      entityType: 'SYSTEM',
      newValues: 'All data reset except User accounts',
    })

    return NextResponse.json({ success: true, message: 'All data has been reset successfully. User accounts preserved. All users will need to log in again.' })
  } catch (error) {
    console.error('Reset Data API error:', error)
    return NextResponse.json({ error: 'Failed to reset data' }, { status: 500 })
  }
}
