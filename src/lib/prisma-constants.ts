// Enum values as const (same as Prisma generated values)
// Using these instead of importing from @prisma/client prevents
// early module loading that breaks on Vercel standalone builds.

export const ExpenseStatus = {
  PENDING: 'PENDING',
  ACCOUNTANT_APPROVED: 'ACCOUNTANT_APPROVED',
  ADMIN_APPROVED: 'ADMIN_APPROVED',
  REJECTED: 'REJECTED',
  RETURNED: 'RETURNED',
  PAID: 'PAID',
} as const

export type ExpenseStatus = (typeof ExpenseStatus)[keyof typeof ExpenseStatus]

export const PaymentMethod = {
  CASH: 'CASH',
  UPI: 'UPI',
  CREDIT: 'CREDIT',
  OFFICE: 'OFFICE',
  BANK_TRANSFER: 'BANK_TRANSFER',
} as const

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod]

export const AdvanceStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  PAID: 'PAID',
  REJECTED: 'REJECTED',
  RETURNED: 'RETURNED',
} as const

export type AdvanceStatus = (typeof AdvanceStatus)[keyof typeof AdvanceStatus]

export const RequisitionStatus = {
  PENDING: 'PENDING',
  STOCK_MANAGER_APPROVED: 'STOCK_MANAGER_APPROVED',
  ADMIN_APPROVED: 'ADMIN_APPROVED',
  REJECTED: 'REJECTED',
  RETURNED: 'RETURNED',
  ORDERED: 'ORDERED',
  RECEIVED: 'RECEIVED',
} as const

export type RequisitionStatus = (typeof RequisitionStatus)[keyof typeof RequisitionStatus]

export const Role = {
  ADMIN: 'ADMIN',
  ACCOUNTANT: 'ACCOUNTANT',
  STOCK_MANAGER: 'STOCK_MANAGER',
  USER: 'USER',
} as const

export type Role = (typeof Role)[keyof typeof Role]

export const Priority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const

export type Priority = (typeof Priority)[keyof typeof Priority]

export const CategoryType = {
  EXPENSE: 'EXPENSE',
  REQUISITION: 'REQUISITION',
  BOTH: 'BOTH',
} as const

export type CategoryType = (typeof CategoryType)[keyof typeof CategoryType]

export const LeaveType = {
  CASUAL: 'CASUAL',
  SICK: 'SICK',
  EARNED: 'EARNED',
  HALF_DAY: 'HALF_DAY',
} as const

export type LeaveType = (typeof LeaveType)[keyof typeof LeaveType]

export const LeaveStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const

export type LeaveStatus = (typeof LeaveStatus)[keyof typeof LeaveStatus]

export const AttendanceStatus = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  HALF_DAY: 'HALF_DAY',
  LEAVE: 'LEAVE',
  HOLIDAY: 'HOLIDAY',
  WEEK_OFF: 'WEEK_OFF',
} as const

export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus]
