import { NextResponse } from "next/server";

export async function GET() {
  try {
    const csv = `title,description,amount,purpose,expected_return_date,site_code,client_code
Travel Advance,Flight tickets for client visit,15000.00,Client meeting travel,2025-02-15,SITE001,CLIENT001
Project Advance,Material purchase for project,25000.00,Construction material,2025-03-01,,`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=advances-upload-template.csv",
      },
    });
  } catch (error) {
    console.error("Download advances template error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
