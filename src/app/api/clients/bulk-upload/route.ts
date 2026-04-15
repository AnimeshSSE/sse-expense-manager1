import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json(
        { error: "Only CSV files are accepted" },
        { status: 400 }
      );
    }

    const text = await file.text();
    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);

    if (lines.length < 2) {
      return NextResponse.json(
        { error: "CSV file must have a header row and at least one data row" },
        { status: 400 }
      );
    }

    // Skip header row
    const dataLines = lines.slice(1);
    const results = { success: 0, failed: 0, errors: [] as { row: number; message: string }[] };

    for (let i = 0; i < dataLines.length; i++) {
      const columns = dataLines[i].split(",").map((col) => col.trim());

      if (columns.length < 2) {
        results.failed++;
        results.errors.push({ row: i + 2, message: "Insufficient columns" });
        continue;
      }

      const [name, code, email, phone, address, city, state] = columns;

      if (!name || !code) {
        results.failed++;
        results.errors.push({
          row: i + 2,
          message: "Name and code are required",
        });
        continue;
      }

      const existingName = await db.client.findUnique({ where: { name } });
      if (existingName) {
        results.failed++;
        results.errors.push({
          row: i + 2,
          message: `Client with name '${name}' already exists`,
        });
        continue;
      }

      const existingCode = await db.client.findUnique({ where: { code } });
      if (existingCode) {
        results.failed++;
        results.errors.push({
          row: i + 2,
          message: `Client with code '${code}' already exists`,
        });
        continue;
      }

      await db.client.create({
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

      results.success++;
    }

    return NextResponse.json(
      {
        message: `Upload complete: ${results.success} clients created, ${results.failed} failed`,
        ...results,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Clients bulk upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
