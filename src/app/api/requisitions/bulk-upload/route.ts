import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const userId = formData.get("userId") as string | null;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

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

      if (columns.length < 5) {
        results.failed++;
        results.errors.push({ row: i + 2, message: "Insufficient columns" });
        continue;
      }

      const [title, description, itemDescription, quantity, unitPrice, urgency, itemCode, siteCode, clientCode] = columns;

      if (!title || !itemDescription || !quantity || !unitPrice) {
        results.failed++;
        results.errors.push({
          row: i + 2,
          message: "title, item_description, quantity, and unit_price are required",
        });
        continue;
      }

      const parsedQuantity = parseInt(quantity);
      if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
        results.failed++;
        results.errors.push({
          row: i + 2,
          message: "Quantity must be a valid positive integer",
        });
        continue;
      }

      const parsedUnitPrice = parseFloat(unitPrice);
      if (isNaN(parsedUnitPrice) || parsedUnitPrice <= 0) {
        results.failed++;
        results.errors.push({
          row: i + 2,
          message: "unit_price must be a valid positive number",
        });
        continue;
      }

      const totalAmount = parsedQuantity * parsedUnitPrice;

      // Look up site by code (optional)
      let siteId: string | null = null;
      if (siteCode) {
        const site = await db.site.findUnique({ where: { code: siteCode } });
        if (!site) {
          results.failed++;
          results.errors.push({
            row: i + 2,
            message: `Site with code '${siteCode}' not found`,
          });
          continue;
        }
        siteId = site.id;
      }

      // Look up client by code (optional)
      let clientId: string | null = null;
      if (clientCode) {
        const client = await db.client.findUnique({ where: { code: clientCode } });
        if (!client) {
          results.failed++;
          results.errors.push({
            row: i + 2,
            message: `Client with code '${clientCode}' not found`,
          });
          continue;
        }
        clientId = client.id;
      }

      // Create requisition with one item
      await db.requisition.create({
        data: {
          title,
          description: description || null,
          userId,
          totalAmount,
          siteId,
          clientId,
          items: {
            create: {
              description: itemDescription,
              quantity: parsedQuantity,
              unitPrice: parsedUnitPrice,
              totalAmount,
              urgency: urgency || "NORMAL",
              itemCode: itemCode || null,
            },
          },
        },
      });

      results.success++;
    }

    return NextResponse.json(
      {
        message: `Upload complete: ${results.success} requisitions created, ${results.failed} failed`,
        ...results,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Requisitions bulk upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
