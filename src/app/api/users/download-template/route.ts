import { NextResponse } from "next/server";

export async function GET() {
  try {
    const csv = `name,email,role,department,employeeId,phone
John Doe,john@example.com,EMPLOYEE,Engineering,EMP011,+91-9876543220
Jane Smith,jane@example.com,MANAGER,Finance,EMP012,+91-9876543221`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=user-upload-template.csv",
      },
    });
  } catch (error) {
    console.error("Download template error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
