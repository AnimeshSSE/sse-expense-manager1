import { NextResponse } from "next/server";

export async function GET() {
  try {
    const csv = `name,code,email,phone,address,city,state`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=clients-upload-template.csv",
      },
    });
  } catch (error) {
    console.error("Download clients template error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
