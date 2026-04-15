import { NextResponse } from "next/server";

export async function GET() {
  try {
    const csv = `title,description,item_description,quantity,unit_price,urgency,item_code,site_code,client_code
Office Furniture,New desks for team,Standing Desk,5,15000.00,HIGH,SKU-DESK-001,SITE001,CLIENT001
IT Equipment,Laptop procurement,ThinkPad T14,3,85000.00,NORMAL,SKU-LAP-002,,`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=requisitions-upload-template.csv",
      },
    });
  } catch (error) {
    console.error("Download requisitions template error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
