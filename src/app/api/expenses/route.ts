import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const userId = searchParams.get("userId");
    const search = searchParams.get("search");
    const department = searchParams.get("department");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.userId = userId;
    }

    if (department) {
      where.department = department;
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { user: { name: { contains: search } } },
        { user: { email: { contains: search } } },
      ];
    }

    const skip = (page - 1) * limit;

    const [expenses, total] = await Promise.all([
      db.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              department: true,
              employeeId: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          items: {
            include: {
              category: true,
            },
            orderBy: { date: "asc" },
          },
        },
      }),
      db.expense.count({ where }),
    ]);

    return NextResponse.json({
      expenses,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("GET expenses error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, userId, department, items } = body;

    if (!title || !userId) {
      return NextResponse.json(
        { error: "Title and userId are required" },
        { status: 400 }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "At least one expense item is required" },
        { status: 400 }
      );
    }

    const totalAmount = items.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0);

    const expense = await db.expense.create({
      data: {
        title,
        description: description || null,
        totalAmount,
        userId,
        department: department || null,
        items: {
          create: items.map((item: { description: string; amount: number; date: string; categoryId: string; receiptUrl?: string; notes?: string }) => ({
            description: item.description,
            amount: item.amount,
            date: new Date(item.date),
            categoryId: item.categoryId,
            receiptUrl: item.receiptUrl || null,
            notes: item.notes || null,
          })),
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
          },
        },
        items: {
          include: {
            category: true,
          },
        },
      },
    });

    return NextResponse.json({ expense }, { status: 201 });
  } catch (error) {
    console.error("POST expenses error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, title, description, department, status, items, userRole } = body;

    if (!id) {
      return NextResponse.json({ error: "Expense ID is required" }, { status: 400 });
    }

    const existing = await db.expense.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    // Check if expense can be edited
    if (existing.status !== "DRAFT" && existing.status !== "SUBMITTED") {
      return NextResponse.json(
        { error: `Cannot edit expense with status ${existing.status}` },
        { status: 400 }
      );
    }

    // Stock Manager and Admin can edit SUBMITTED expenses
    if (
      existing.status === "SUBMITTED" &&
      userRole !== "STOCK_MANAGER" &&
      userRole !== "ADMIN"
    ) {
      return NextResponse.json(
        { error: "Only Stock Manager or Admin can edit submitted expenses" },
        { status: 403 }
      );
    }

    // Calculate totalAmount from items
    let totalAmount = existing.totalAmount;
    if (items && items.length > 0) {
      totalAmount = items.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0);
    }

    const expense = await db.expense.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(department !== undefined && { department }),
        ...(status !== undefined && { status }),
        ...(items && { totalAmount }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            category: true,
          },
          orderBy: { date: "asc" },
        },
      },
    });

    // Update items if provided
    if (items && items.length > 0) {
      // Delete existing items
      await db.expenseItem.deleteMany({ where: { expenseId: id } });

      // Create new items
      for (const item of items) {
        await db.expenseItem.create({
          data: {
            description: item.description,
            amount: item.amount,
            date: new Date(item.date),
            categoryId: item.categoryId,
            receiptUrl: item.receiptUrl || null,
            notes: item.notes || null,
            expenseId: id,
          },
        });
      }

      // Refetch with updated items
      const updated = await db.expense.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              department: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          items: {
            include: {
              category: true,
            },
            orderBy: { date: "asc" },
          },
        },
      });

      return NextResponse.json({ expense: updated });
    }

    return NextResponse.json({ expense });
  } catch (error) {
    console.error("PUT expenses error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
