import { NextResponse } from "next/server";

export async function GET() {
  try {
    const csv = `name,code`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=categories-upload-template.csv",
      },
    });
  } catch (error) {
    console.error("Download categories template error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
