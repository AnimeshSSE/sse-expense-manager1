import { cookies } from 'next/headers';
import { db } from './db';
import { Role } from '@prisma/client';

// Simple password hashing using Bun's built-in crypto
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

export function generateToken(): string {
  return crypto.randomUUID() + '-' + Date.now() + '-' + Math.random().toString(36).substring(2);
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
