import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const advance = await db.advance.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: true,
            employeeId: true,
            phone: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        auditLogs: {
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!advance) {
      return NextResponse.json({ error: "Advance not found" }, { status: 404 });
    }

    return NextResponse.json({ advance });
  } catch (error) {
    console.error("GET advance by id error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.advance.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Advance not found" }, { status: 404 });
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft advances can be deleted" },
        { status: 400 }
      );
    }

    await db.advance.delete({ where: { id } });

    return NextResponse.json({ message: "Advance deleted successfully" });
  } catch (error) {
    console.error("DELETE advance error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
