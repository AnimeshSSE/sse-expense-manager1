import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "Download not available in production" }, { status: 404 });
}
