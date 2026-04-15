import { NextResponse } from "next/server";

export async function GET() {
  try {
    const csv = `name,code,address,city,state,pincode`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=sites-upload-template.csv",
      },
    });
  } catch (error) {
    console.error("Download sites template error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
