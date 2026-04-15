import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const categories = await db.expenseCategory.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { expenseItems: true },
        },
      },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("GET categories error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, code } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: "Name and code are required" },
        { status: 400 }
      );
    }

    const existingName = await db.expenseCategory.findUnique({ where: { name } });
    if (existingName) {
      return NextResponse.json(
        { error: "Category with this name already exists" },
        { status: 400 }
      );
    }

    const existingCode = await db.expenseCategory.findUnique({ where: { code } });
    if (existingCode) {
      return NextResponse.json(
        { error: "Category with this code already exists" },
        { status: 400 }
      );
    }

    const category = await db.expenseCategory.create({
      data: {
        name,
        code,
      },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error("POST categories error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, code } = body;

    if (!id) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 });
    }

    const existing = await db.expenseCategory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    if (name && name !== existing.name) {
      const nameExists = await db.expenseCategory.findUnique({ where: { name } });
      if (nameExists) {
        return NextResponse.json(
          { error: "Category with this name already exists" },
          { status: 400 }
        );
      }
    }

    if (code && code !== existing.code) {
      const codeExists = await db.expenseCategory.findUnique({ where: { code } });
      if (codeExists) {
        return NextResponse.json(
          { error: "Category with this code already exists" },
          { status: 400 }
        );
      }
    }

    const category = await db.expenseCategory.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
      },
    });

    return NextResponse.json({ category });
  } catch (error) {
    console.error("PUT categories error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 });
    }

    const existing = await db.expenseCategory.findUnique({
      where: { id },
      include: { _count: { select: { expenseItems: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    if (existing._count.expenseItems > 0) {
      return NextResponse.json(
        { error: "Cannot delete category that has expense items associated with it" },
        { status: 400 }
      );
    }

    await db.expenseCategory.delete({ where: { id } });

    return NextResponse.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("DELETE categories error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
