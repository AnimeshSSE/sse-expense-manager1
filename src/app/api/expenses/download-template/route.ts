import { NextResponse } from "next/server";

export async function GET() {
  try {
    const csv = `title,description,category_code,item_description,amount,item_date,site_code,client_code
Office Supplies,Purchase of office items,TRAVEL,Flight to client site,5000.00,2025-01-15,SITE001,CLIENT001
Team Lunch,Monthly team lunch,FOOD,Restaurant bill,3500.00,2025-01-20,,`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=expenses-upload-template.csv",
      },
    });
  } catch (error) {
    console.error("Download expenses template error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
