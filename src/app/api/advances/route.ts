import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const userId = searchParams.get("userId");
    const department = searchParams.get("department");
    const search = searchParams.get("search");
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
        { purpose: { contains: search } },
        { user: { name: { contains: search } } },
      ];
    }

    const skip = (page - 1) * limit;

    const [advances, total] = await Promise.all([
      db.advance.findMany({
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
        },
      }),
      db.advance.count({ where }),
    ]);

    return NextResponse.json({
      advances,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("GET advances error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, userId, department, amount, purpose, expectedReturnDate } = body;

    if (!title || !userId || !amount || !purpose) {
      return NextResponse.json(
        { error: "Title, userId, amount, and purpose are required" },
        { status: 400 }
      );
    }

    const advance = await db.advance.create({
      data: {
        title,
        description: description || null,
        amount: parseFloat(amount),
        purpose,
        userId,
        department: department || null,
        expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
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
      },
    });

    return NextResponse.json({ advance }, { status: 201 });
  } catch (error) {
    console.error("POST advances error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      title,
      description,
      department,
      status,
      amount,
      purpose,
      expectedReturnDate,
      settlementAmount,
      settlementDate,
      userRole,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Advance ID is required" },
        { status: 400 }
      );
    }

    const existing = await db.advance.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Advance not found" }, { status: 404 });
    }

    if (existing.status !== "DRAFT" && existing.status !== "SUBMITTED") {
      return NextResponse.json(
        { error: `Cannot edit advance with status ${existing.status}` },
        { status: 400 }
      );
    }

    // Stock Manager and Admin can edit SUBMITTED advances
    if (
      existing.status === "SUBMITTED" &&
      userRole !== "STOCK_MANAGER" &&
      userRole !== "ADMIN"
    ) {
      return NextResponse.json(
        { error: "Only Stock Manager or Admin can edit submitted advances" },
        { status: 403 }
      );
    }

    const advance = await db.advance.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(department !== undefined && { department }),
        ...(status !== undefined && { status }),
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(purpose !== undefined && { purpose }),
        ...(expectedReturnDate !== undefined && {
          expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
        }),
        ...(settlementAmount !== undefined && {
          settlementAmount: settlementAmount ? parseFloat(settlementAmount) : null,
        }),
        ...(settlementDate !== undefined && {
          settlementDate: settlementDate ? new Date(settlementDate) : null,
        }),
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
      },
    });

    return NextResponse.json({ advance });
  } catch (error) {
    console.error("PUT advances error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
