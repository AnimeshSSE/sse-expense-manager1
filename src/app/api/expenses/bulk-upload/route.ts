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

      if (columns.length < 6) {
        results.failed++;
        results.errors.push({ row: i + 2, message: "Insufficient columns" });
        continue;
      }

      const [title, description, categoryCode, itemDescription, amount, itemDate, siteCode, clientCode] = columns;

      if (!title || !categoryCode || !itemDescription || !amount || !itemDate) {
        results.failed++;
        results.errors.push({
          row: i + 2,
          message: "title, category_code, item_description, amount, and item_date are required",
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

      const parsedDate = new Date(itemDate);
      if (isNaN(parsedDate.getTime())) {
        results.failed++;
        results.errors.push({
          row: i + 2,
          message: "item_date must be a valid date (yyyy-mm-dd)",
        });
        continue;
      }

      // Look up category by code
      const category = await db.expenseCategory.findUnique({ where: { code: categoryCode } });
      if (!category) {
        results.failed++;
        results.errors.push({
          row: i + 2,
          message: `Category with code '${categoryCode}' not found`,
        });
        continue;
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

      // Create expense with one item
      await db.expense.create({
        data: {
          title,
          description: description || null,
          userId,
          totalAmount: parsedAmount,
          siteId,
          clientId,
          items: {
            create: {
              description: itemDescription,
              amount: parsedAmount,
              date: parsedDate,
              categoryId: category.id,
            },
          },
        },
      });

      results.success++;
    }

    return NextResponse.json(
      {
        message: `Upload complete: ${results.success} expenses created, ${results.failed} failed`,
        ...results,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Expenses bulk upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
