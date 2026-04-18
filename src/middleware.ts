import { NextRequest, NextResponse } from "next/server";
import { verifyTokenEdge } from "@/lib/session-edge";

export async function middleware(request: NextRequest) {
  // Only protect /api/ routes (except auth)
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    // Allow auth endpoint without session
    if (pathname === "/api/auth") {
      return NextResponse.next();
    }

    // Check for authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized: Missing authorization header" },
        { status: 401 }
      );
    }

    // Verify token signature and expiry (edge-compatible)
    const token = authHeader.replace("Bearer ", "");
    const session = await verifyTokenEdge(token);
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or expired token" },
        { status: 401 }
      );
    }

    // Add user info to request headers for API routes to use
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", session.userId);
    requestHeaders.set("x-user-role", session.role);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
