import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { city: { contains: search } },
        { state: { contains: search } },
      ];
    }

    const skip = (page - 1) * limit;

    const [sites, total] = await Promise.all([
      db.site.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      db.site.count({ where }),
    ]);

    return NextResponse.json({
      sites,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("GET sites error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, code, address, city, state, pincode } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: "Name and code are required" },
        { status: 400 }
      );
    }

    const existingName = await db.site.findUnique({ where: { name } });
    if (existingName) {
      return NextResponse.json(
        { error: "Site with this name already exists" },
        { status: 400 }
      );
    }

    const existingCode = await db.site.findUnique({ where: { code } });
    if (existingCode) {
      return NextResponse.json(
        { error: "Site with this code already exists" },
        { status: 400 }
      );
    }

    const site = await db.site.create({
      data: {
        name,
        code,
        address: address || null,
        city: city || null,
        state: state || null,
        pincode: pincode || null,
      },
    });

    return NextResponse.json({ site }, { status: 201 });
  } catch (error) {
    console.error("POST sites error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, code, address, city, state, pincode, status } = body;

    if (!id) {
      return NextResponse.json({ error: "Site ID is required" }, { status: 400 });
    }

    const existing = await db.site.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    if (name && name !== existing.name) {
      const nameExists = await db.site.findUnique({ where: { name } });
      if (nameExists) {
        return NextResponse.json(
          { error: "Site with this name already exists" },
          { status: 400 }
        );
      }
    }

    if (code && code !== existing.code) {
      const codeExists = await db.site.findUnique({ where: { code } });
      if (codeExists) {
        return NextResponse.json(
          { error: "Site with this code already exists" },
          { status: 400 }
        );
      }
    }

    const site = await db.site.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(address !== undefined && { address }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(pincode !== undefined && { pincode }),
        ...(status !== undefined && { status }),
      },
    });

    return NextResponse.json({ site });
  } catch (error) {
    console.error("PUT sites error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
