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

      if (columns.length < 4) {
        results.failed++;
        results.errors.push({ row: i + 2, message: "Insufficient columns" });
        continue;
      }

      const [title, description, amount, purpose, expectedReturnDate, siteCode, clientCode] = columns;

      if (!title || !amount || !purpose) {
        results.failed++;
        results.errors.push({
          row: i + 2,
          message: "title, amount, and purpose are required",
        });
        continue;
      }

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        results.failed++;
        results.errors.push({
          row: i + 2,
          message: "Amount must be a valid positive number",
        });
        continue;
      }

      // Parse expected return date (optional)
      let parsedReturnDate: Date | null = null;
      if (expectedReturnDate) {
        parsedReturnDate = new Date(expectedReturnDate);
        if (isNaN(parsedReturnDate.getTime())) {
          results.failed++;
          results.errors.push({
            row: i + 2,
            message: "expected_return_date must be a valid date (yyyy-mm-dd)",
          });
          continue;
        }
      }

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

      await db.advance.create({
        data: {
          title,
          description: description || null,
          amount: parsedAmount,
          purpose,
          userId,
          expectedReturnDate: parsedReturnDate,
          siteId,
          clientId,
        },
      });

      results.success++;
    }

    return NextResponse.json(
      {
        message: `Upload complete: ${results.success} advances created, ${results.failed} failed`,
        ...results,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Advances bulk upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
