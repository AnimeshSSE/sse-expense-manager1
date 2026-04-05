import { cookies } from 'next/headers';
import { db } from './db';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Secure password hashing with bcrypt (salt + key stretching)
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Support both bcrypt hashes (new) and SHA-256 hex hashes (legacy migration)
  if (hash.length === 64 && /^[a-f0-9]+$/.test(hash)) {
    // Legacy SHA-256 hash — verify and upgrade on next login
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return passwordHash === hash;
  }
  return bcrypt.compare(password, hash);
}

// Cryptographically secure token generation
export function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
}

export async function getSession(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) return null;

  const user = await db.user.findUnique({
    where: { token },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      tokenExpiry: true,
    },
  });

  if (!user || !user.isActive) return null;
  if (user.tokenExpiry && user.tokenExpiry < new Date()) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
  };
}

// Permission checking
type Permission =
  | 'VIEW_ALL_EXPENSES' | 'VIEW_OWN_EXPENSES' | 'SUBMIT_EXPENSE'
  | 'ACCOUNTANT_APPROVE_EXPENSE' | 'ADMIN_APPROVE_EXPENSE' | 'MARK_EXPENSE_PAID'
  | 'VIEW_ALL_MIRS' | 'VIEW_OWN_MIRS' | 'SUBMIT_MIR'
  | 'STOCK_MANAGER_APPROVE_MIR' | 'ADMIN_APPROVE_MIR' | 'ORDER_MIR' | 'RECEIVE_MIR'
  | 'MANAGE_USERS' | 'MANAGE_CLIENTS' | 'MANAGE_SITES' | 'MANAGE_CATEGORIES'
  | 'VIEW_AUDIT_LOGS' | 'EXPORT_DATA';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    'VIEW_ALL_EXPENSES', 'VIEW_OWN_EXPENSES', 'SUBMIT_EXPENSE',
    'ACCOUNTANT_APPROVE_EXPENSE', 'ADMIN_APPROVE_EXPENSE', 'MARK_EXPENSE_PAID',
    'VIEW_ALL_MIRS', 'VIEW_OWN_MIRS', 'SUBMIT_MIR',
    'STOCK_MANAGER_APPROVE_MIR', 'ADMIN_APPROVE_MIR', 'ORDER_MIR', 'RECEIVE_MIR',
    'MANAGE_USERS', 'MANAGE_CLIENTS', 'MANAGE_SITES', 'MANAGE_CATEGORIES',
    'VIEW_AUDIT_LOGS', 'EXPORT_DATA',
  ],
  ACCOUNTANT: [
    'VIEW_ALL_EXPENSES', 'VIEW_OWN_EXPENSES', 'SUBMIT_EXPENSE',
    'ACCOUNTANT_APPROVE_EXPENSE', 'MARK_EXPENSE_PAID',
    'VIEW_OWN_MIRS', 'SUBMIT_MIR',
  ],
  STOCK_MANAGER: [
    'VIEW_OWN_EXPENSES', 'SUBMIT_EXPENSE',
    'VIEW_ALL_MIRS', 'VIEW_OWN_MIRS', 'SUBMIT_MIR',
    'STOCK_MANAGER_APPROVE_MIR', 'ORDER_MIR', 'RECEIVE_MIR',
  ],
  USER: [
    'VIEW_OWN_EXPENSES', 'SUBMIT_EXPENSE',
    'VIEW_OWN_MIRS', 'SUBMIT_MIR',
  ],
};

export function checkPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getPermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

// Extract client IP from request headers
export function getClientIp(request: Request): string {
  const headers = request.headers;
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || headers.get('x-real-ip')
    || 'unknown';
}
