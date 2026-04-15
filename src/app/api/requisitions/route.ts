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
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortDir = searchParams.get("sortDir") || "desc";

    const userRole = searchParams.get("userRole");

    const where: Record<string, unknown> = {};

    // Role-based filtering
    if (userRole === "EMPLOYEE" && userId) {
      where.userId = userId;
    }
    // STOCK_MANAGER, MANAGER, ADMIN see all requisitions

    if (status) {
      where.status = status;
    }

    if (userId && (userRole === "MANAGER" || userRole === "ADMIN" || userRole === "STOCK_MANAGER" || !userRole)) {
      // Admin/Manager/StockManager can optionally filter by specific user
    } else if (userId && userRole !== "EMPLOYEE") {
      where.userId = userId;
    }

    if (department) {
      where.department = department;
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { vendorName: { contains: search } },
        { user: { name: { contains: search } } },
      ];
    }

    const skip = (page - 1) * limit;

    const orderBy: Record<string, string> = {};
    if (sortBy === "amount" || sortBy === "totalAmount") {
      orderBy[sortBy] = sortDir;
    } else if (sortBy === "title") {
      orderBy.title = sortDir;
    } else {
      orderBy.createdAt = sortDir;
    }

    const [requisitions, total] = await Promise.all([
      db.requisition.findMany({
        where,
        skip,
        take: limit,
        orderBy,
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
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      db.requisition.count({ where }),
    ]);

    return NextResponse.json({
      requisitions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("GET requisitions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, userId, department, vendorName, deliveryDate, items } = body;

    if (!title || !userId) {
      return NextResponse.json(
        { error: "Title and userId are required" },
        { status: 400 }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "At least one requisition item is required" },
        { status: 400 }
      );
    }

    const totalAmount = items.reduce(
      (sum: number, item: { quantity: number; unitPrice: number }) => sum + item.quantity * item.unitPrice,
      0
    );

    const requisition = await db.requisition.create({
      data: {
        title,
        description: description || null,
        totalAmount,
        userId,
        department: department || null,
        vendorName: vendorName || null,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        items: {
          create: items.map(
            (item: {
              description: string;
              quantity: number;
              unitPrice: number;
              urgency?: string;
              itemCode?: string;
              notes?: string;
            }) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalAmount: item.quantity * item.unitPrice,
              urgency: item.urgency || "NORMAL",
              itemCode: item.itemCode || null,
              notes: item.notes || null,
            })
          ),
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
        items: true,
      },
    });

    return NextResponse.json({ requisition }, { status: 201 });
  } catch (error) {
    console.error("POST requisitions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, title, description, department, vendorName, deliveryDate, status, items, userRole } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Requisition ID is required" },
        { status: 400 }
      );
    }

    const existing = await db.requisition.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Requisition not found" }, { status: 404 });
    }

    if (existing.status !== "DRAFT" && existing.status !== "SUBMITTED") {
      return NextResponse.json(
        { error: `Cannot edit requisition with status ${existing.status}` },
        { status: 400 }
      );
    }

    // Stock Manager and Admin can edit SUBMITTED requisitions
    if (
      existing.status === "SUBMITTED" &&
      userRole !== "STOCK_MANAGER" &&
      userRole !== "ADMIN"
    ) {
      return NextResponse.json(
        { error: "Only Stock Manager or Admin can edit submitted requisitions" },
        { status: 403 }
      );
    }

    // Calculate totalAmount from items if provided
    let totalAmount = existing.totalAmount;
    if (items && items.length > 0) {
      totalAmount = items.reduce(
        (sum: number, item: { quantity: number; unitPrice: number }) =>
          sum + item.quantity * item.unitPrice,
        0
      );
    }

    const requisition = await db.requisition.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(department !== undefined && { department }),
        ...(vendorName !== undefined && { vendorName }),
        ...(deliveryDate !== undefined && {
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        }),
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
          orderBy: { createdAt: "asc" },
        },
      },
    });

    // Update items if provided
    if (items && items.length > 0) {
      await db.requisitionItem.deleteMany({ where: { requisitionId: id } });

      for (const item of items) {
        await db.requisitionItem.create({
          data: {
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalAmount: item.quantity * item.unitPrice,
            urgency: item.urgency || "NORMAL",
            itemCode: item.itemCode || null,
            notes: item.notes || null,
            requisitionId: id,
          },
        });
      }

      const updated = await db.requisition.findUnique({
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
            orderBy: { createdAt: "asc" },
          },
        },
      });

      return NextResponse.json({ requisition: updated });
    }

    return NextResponse.json({ requisition });
  } catch (error) {
    console.error("PUT requisitions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
