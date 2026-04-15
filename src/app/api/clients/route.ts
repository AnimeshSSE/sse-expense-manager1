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
        { email: { contains: search } },
        { city: { contains: search } },
      ];
    }

    const skip = (page - 1) * limit;

    const [clients, total] = await Promise.all([
      db.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      db.client.count({ where }),
    ]);

    return NextResponse.json({
      clients,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("GET clients error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, code, email, phone, address, city, state } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: "Name and code are required" },
        { status: 400 }
      );
    }

    const existingName = await db.client.findUnique({ where: { name } });
    if (existingName) {
      return NextResponse.json(
        { error: "Client with this name already exists" },
        { status: 400 }
      );
    }

    const existingCode = await db.client.findUnique({ where: { code } });
    if (existingCode) {
      return NextResponse.json(
        { error: "Client with this code already exists" },
        { status: 400 }
      );
    }

    const client = await db.client.create({
      data: {
        name,
        code,
        email: email || null,
        phone: phone || null,
        address: address || null,
        city: city || null,
        state: state || null,
      },
    });

    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    console.error("POST clients error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, code, email, phone, address, city, state, status } = body;

    if (!id) {
      return NextResponse.json({ error: "Client ID is required" }, { status: 400 });
    }

    const existing = await db.client.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (name && name !== existing.name) {
      const nameExists = await db.client.findUnique({ where: { name } });
      if (nameExists) {
        return NextResponse.json(
          { error: "Client with this name already exists" },
          { status: 400 }
        );
      }
    }

    if (code && code !== existing.code) {
      const codeExists = await db.client.findUnique({ where: { code } });
      if (codeExists) {
        return NextResponse.json(
          { error: "Client with this code already exists" },
          { status: 400 }
        );
      }
    }

    const client = await db.client.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(status !== undefined && { status }),
      },
    });

    return NextResponse.json({ client });
  } catch (error) {
    console.error("PUT clients error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
