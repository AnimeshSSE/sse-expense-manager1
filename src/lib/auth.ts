import { NextRequest } from "next/server";
import { verifyToken, type SessionPayload } from "@/lib/session";

/**
 * Get the current user's session from the request headers.
 * The middleware already verified the token and set x-user-id / x-user-role headers.
 */
export function getSession(request: NextRequest): SessionPayload | null {
  const userId = request.headers.get("x-user-id");
  const role = request.headers.get("x-user-role");

  if (!userId || !role) return null;

  return { userId, role };
}

/**
 * Check if user has one of the allowed roles.
 */
export function hasRole(role: string, allowedRoles: string[]): boolean {
  return allowedRoles.includes(role);
}
