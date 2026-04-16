import { create } from 'zustand'

export type UserRole = 'ADMIN' | 'MANAGER' | 'STOCK_MANAGER' | 'EMPLOYEE'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  department: string
  employeeId: string
  avatar?: string
  status: 'ACTIVE' | 'INACTIVE'
}

export type ExpenseStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PAID'
export type RequisitionStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'FULFILLED'
export type AdvanceStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'DISBURSED' | 'SETTLED'

export interface ExpenseItem {
  id: string
  description: string
  amount: number
  date: string
  category: string | { id: string; name: string; code: string }
  categoryId?: string
  expenseId?: string
  receiptUrl?: string | null
  notes?: string | null
}

export interface Expense {
  id: string
  title: string
  description: string | null
  department: string | null
  status: ExpenseStatus
  totalAmount: number
  items: ExpenseItem[]
  userId: string
  user: Pick<User, 'id' | 'name' | 'email' | 'department' | 'employeeId'>
  approvedById?: string | null
  approvedBy?: Pick<User, 'id' | 'name' | 'email'> | null
  submittedDate?: string | null
  approvedAt?: string | null
  rejectedReason?: string | null
  paymentDate?: string | null
  paymentRef?: string | null
  createdAt: string
  updatedAt: string
}

export interface RequisitionItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  totalAmount: number
  urgency: string
  itemCode?: string | null
  notes?: string | null
  requisitionId?: string
}

export interface Requisition {
  id: string
  title: string
  description: string | null
  department: string | null
  vendorName: string | null
  deliveryDate: string | null
  status: RequisitionStatus
  totalAmount: number
  items: RequisitionItem[]
  userId: string
  user: Pick<User, 'id' | 'name' | 'email' | 'department' | 'employeeId'>
  approvedById?: string | null
  approvedBy?: Pick<User, 'id' | 'name' | 'email'> | null
  submittedDate?: string | null
  approvedAt?: string | null
  rejectedReason?: string | null
  createdAt: string
  updatedAt: string
}

export interface Advance {
  id: string
  title: string
  description: string | null
  department: string | null
  amount: number
  purpose: string
  expectedReturnDate: string | null
  status: AdvanceStatus
  settlementAmount?: number | null
  settlementDate?: string | null
  userId: string
  user: Pick<User, 'id' | 'name' | 'email' | 'department' | 'employeeId'>
  approvedById?: string | null
  approvedBy?: Pick<User, 'id' | 'name' | 'email'> | null
  submittedDate?: string | null
  approvedAt?: string | null
  rejectedReason?: string | null
  createdAt: string
  updatedAt: string
}

export type PageType = 'dashboard' | 'expenses' | 'requisitions' | 'advances' | 'sites' | 'clients' | 'categories' | 'users' | 'settings'
export type FormMode = 'create' | 'edit' | 'view'

interface AppState {
  // Auth
  currentUser: User | null
  setCurrentUser: (user: User | null) => void
  logout: () => void

  // Navigation
  currentPage: PageType
  setCurrentPage: (page: PageType) => void

  // Expenses
  selectedExpenseId: string | null
  setSelectedExpenseId: (id: string | null) => void
  expenseFormMode: FormMode
  setExpenseFormMode: (mode: FormMode) => void

  // Requisitions
  selectedRequisitionId: string | null
  setSelectedRequisitionId: (id: string | null) => void
  requisitionFormMode: FormMode
  setRequisitionFormMode: (mode: FormMode) => void

  // Advances
  selectedAdvanceId: string | null
  setSelectedAdvanceId: (id: string | null) => void
  advanceFormMode: FormMode
  setAdvanceFormMode: (mode: FormMode) => void

  // Print
  isPrintMode: boolean
  setIsPrintMode: (mode: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  // Auth
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token')
    }
    set({ currentUser: null })
  },

  // Navigation
  currentPage: 'dashboard',
  setCurrentPage: (page) => set({ currentPage: page }),

  // Expenses
  selectedExpenseId: null,
  setSelectedExpenseId: (id) => set({ selectedExpenseId: id }),
  expenseFormMode: 'create',
  setExpenseFormMode: (mode) => set({ expenseFormMode: mode }),

  // Requisitions
  selectedRequisitionId: null,
  setSelectedRequisitionId: (id) => set({ selectedRequisitionId: id }),
  requisitionFormMode: 'create',
  setRequisitionFormMode: (mode) => set({ requisitionFormMode: mode }),

  // Advances
  selectedAdvanceId: null,
  setSelectedAdvanceId: (id) => set({ selectedAdvanceId: id }),
  advanceFormMode: 'create',
  setAdvanceFormMode: (mode) => set({ advanceFormMode: mode }),

  // Print
  isPrintMode: false,
  setIsPrintMode: (mode) => set({ isPrintMode: mode }),
}))

export const departments = [
  'Engineering',
  'Marketing',
  'Finance',
  'Procurement',
  'Human Resources',
  'Operations',
]

export const expenseCategories = [
  'Travel',
  'Meals',
  'Supplies',
  'Equipment',
  'Software',
  'Events',
  'Training',
  'Other',
]

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount)
