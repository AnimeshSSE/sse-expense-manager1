import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const sites = await db.site.findMany({
      select: {
        id: true,
        name: true,
        clientId: true,
        location: true,
        description: true,
        budget: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        client: {
          select: { name: true },
        },
        _count: {
          select: { expenses: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Compute total spent (expenses + requisitions) per site
    const sitesWithSpent = await Promise.all(sites.map(async (site) => {
      const [expenseTotal, requisitionTotal] = await Promise.all([
        db.expense.aggregate({ where: { siteId: site.id }, _sum: { amount: true } }),
        db.requisition.aggregate({ where: { siteId: site.id }, _sum: { totalAmount: true } }),
      ])
      return {
        ...site,
        totalSpent: (expenseTotal._sum.amount || 0) + (requisitionTotal._sum.totalAmount || 0),
      }
    }))

    return NextResponse.json({
      sites: sitesWithSpent.map((s) => ({
        ...s,
        clientName: s.client.name,
        client: undefined,
        expenseCount: s._count.expenses,
        _count: undefined,
      })),
    });
  } catch (error: any) {
    console.error('Get sites error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!checkPermission(session.role, 'MANAGE_SITES')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, clientId, location, description, budget } = body;

    if (!name || !clientId) {
      return NextResponse.json(
        { error: 'Site name and client are required' },
        { status: 400 }
      );
    }

    const clientExists = await db.client.findUnique({ where: { id: clientId } });
    if (!clientExists) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    const site = await db.site.create({
      data: {
        name,
        clientId,
        location: location || null,
        description: description || null,
        budget: budget || 0,
      },
      include: {
        client: {
          select: { name: true },
        },
      },
    });

    return NextResponse.json({ clientName: site.client.name, ...site, client: undefined }, { status: 201 });
  } catch (error: any) {
    console.error('Create site error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
