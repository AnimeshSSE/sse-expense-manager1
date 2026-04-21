import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkPermission } from '@/lib/permissions'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const leave = await db.leave.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        approvedBy: { select: { id: true, name: true } },
      },
    })

    if (!leave) return NextResponse.json({ error: 'Leave not found' }, { status: 404 })

    // USER can only see their own leaves
    if (!checkPermission(session.role, 'VIEW_ALL_LEAVES')) {
      const myEmployee = await db.employee.findUnique({
        where: { userId: session.id },
        select: { id: true },
      })
      if (!myEmployee || myEmployee.id !== leave.employeeId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json({ leave })
  } catch (error) {
    console.error('GET /api/leaves/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch leave' }, { status: 500 })
  }
}
