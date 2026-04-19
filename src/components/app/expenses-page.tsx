'use client'

import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useLanguage } from '@/hooks/use-language'
import { api } from '@/lib/api'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Plus, Search, Filter, MoreHorizontal, Eye, Pencil, Trash2, CheckCircle2,
  XCircle, RotateCcw, Send, Banknote, Upload, Download, FileSpreadsheet,
  ChevronLeft, ChevronRight, ChevronDown, AlertTriangle, FileText,
  ArrowUpDown, Receipt as ReceiptIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import type { ExpenseStatus as ExpenseStatusType, PaymentMethod } from '@prisma/client'

// ==================== Types ====================

interface ExpenseItem {
  id: string
  siteId: string
  categoryId: string
  userId: string
  amount: number
  description: string
  expenseDate: string
  submissionDate: string
  sellerName: string | null
  invoiceNumber: string | null
  paymentMethod: PaymentMethod
  status: ExpenseStatusType
  notes: string | null
  rejectionReason: string | null
  returnReason: string | null
  isLateSubmission: boolean
  daysLate: number
  createdAt: string
  updatedAt: string
  site: { id: string; name: string; clientId: string; client?: { id: string; name: string } }
  category: { id: string; name: string }
  user: { id: string; name: string; email: string }
  accountantApprovedBy: { id: string; name: string } | null
  adminApprovedBy: { id: string; name: string } | null
  comments?: CommentItem[]
}

interface CommentItem {
  id: string
  content: string
  createdAt: string
  user: { id: string; name: string; role: string }
}

interface SiteItem { id: string; name: string; clientId: string; client?: { id: string; name: string } }
interface CategoryItem { id: string; name: string }
interface UserItem { id: string; name: string; email: string; role: string }

interface PaginationResult {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

// ==================== Status Helpers ====================

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-100 border-amber-300' },
  ACCOUNTANT_APPROVED: { label: 'Acct. Approved', color: 'text-blue-700', bg: 'bg-blue-100 border-blue-300' },
  ADMIN_APPROVED: { label: 'Admin Approved', color: 'text-indigo-700', bg: 'bg-indigo-100 border-indigo-300' },
  PAID: { label: 'Paid', color: 'text-green-700', bg: 'bg-green-100 border-green-300' },
  REJECTED: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-100 border-red-300' },
  RETURNED: { label: 'Returned', color: 'text-orange-700', bg: 'bg-orange-100 border-orange-300' },
}

const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'UPI', 'CREDIT', 'OFFICE']

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { label: status, color: 'text-gray-700', bg: 'bg-gray-100 border-gray-300' }
  return (
    <Badge variant="outline" className={`${config.bg} ${config.color} border text-xs font-medium px-2 py-0.5`}>
      {config.label}
    </Badge>
  )
}

// ==================== Main Component ====================

export function ExpensesPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  // Filters state
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [siteFilter, setSiteFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [amountFrom, setAmountFrom] = useState('')
  const [amountTo, setAmountTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState('20')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Dialog states
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null)
  const [viewingExpense, setViewingExpense] = useState<ExpenseItem | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null)
  const [showRejectDialog, setShowRejectDialog] = useState<string | null>(null)
  const [showReturnDialog, setShowReturnDialog] = useState<string | null>(null)
  const [showBulkActionDialog, setShowBulkActionDialog] = useState<string | null>(null)
  const [showBulkUploadDialog, setShowBulkUploadDialog] = useState(false)
  const [showFilterBar, setShowFilterBar] = useState(false)
  const [reasonText, setReasonText] = useState('')

  // Form state
  const [form, setForm] = useState({
    siteId: '', categoryId: '', amount: '', description: '', expenseDate: '',
    sellerName: '', invoiceNumber: '', paymentMethod: 'CASH' as PaymentMethod,
    notes: '', userId: '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Bulk upload
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadResults, setUploadResults] = useState<{ success: number; errors: { row: number; field: string; message: string }[] } | null>(null)

  // Role-based helpers
  const canViewAll = user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT'
  const canApproveAccountant = user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT'
  const canApproveAdmin = user?.role === 'ADMIN'
  const canMarkPaid = user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT'
  const canRejectOrReturn = canViewAll

  // Build filter params
  const filters = useMemo(() => {
    const params: Record<string, string> = {}
    if (search) params.search = search
    if (statusFilter) params.status = statusFilter
    if (siteFilter) params.siteId = siteFilter
    if (categoryFilter) params.categoryId = categoryFilter
    if (dateFrom) params.dateFrom = dateFrom
    if (dateTo) params.dateTo = dateTo
    if (amountFrom) params.amountFrom = amountFrom
    if (amountTo) params.amountTo = amountTo
    params.page = String(page)
    params.pageSize = pageSize
    params.sortBy = sortBy
    params.sortOrder = sortOrder
    return params
  }, [search, statusFilter, siteFilter, categoryFilter, dateFrom, dateTo, amountFrom, amountTo, page, pageSize, sortBy, sortOrder])

  // Queries
  const { data: expensesData, isLoading } = useQuery<{
    data: ExpenseItem[]
    pagination: PaginationResult
  }>({
    queryKey: ['expenses', filters],
    queryFn: () => api.getExpenses(filters) as Promise<{ data: ExpenseItem[]; pagination: PaginationResult }>,
  })

  const { data: sites } = useQuery<{ data: SiteItem[] }>({
    queryKey: ['sites'],
    queryFn: () => api.getSites() as Promise<{ data: SiteItem[] }>,
  })

  const { data: categories } = useQuery<{ data: CategoryItem[] }>({
    queryKey: ['categories'],
    queryFn: () => api.getCategories() as Promise<{ data: CategoryItem[] }>,
  })

  const { data: users } = useQuery<{ data: UserItem[] }>({
    queryKey: ['users'],
    queryFn: () => api.getUsers() as Promise<{ data: UserItem[] }>,
    enabled: canViewAll,
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.createExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Expense created successfully')
      closeFormDialog()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.updateExpense(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Expense updated successfully')
      closeFormDialog()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Expense deleted')
      setShowDeleteDialog(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const approveAcctMutation = useMutation({
    mutationFn: (id: string) => api.approveAccountantExpense(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Expense approved by accountant') },
    onError: (err: Error) => toast.error(err.message),
  })

  const approveAdminMutation = useMutation({
    mutationFn: (id: string) => api.approveAdminExpense(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Expense approved by admin') },
    onError: (err: Error) => toast.error(err.message),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.rejectExpense(id, reason),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Expense rejected'); setShowRejectDialog(null); setReasonText('') },
    onError: (err: Error) => toast.error(err.message),
  })

  const returnMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.returnExpense(id, reason),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Expense returned'); setShowReturnDialog(null); setReasonText('') },
    onError: (err: Error) => toast.error(err.message),
  })

  const resubmitMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.resubmitExpense(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Expense resubmitted'); closeFormDialog() },
    onError: (err: Error) => toast.error(err.message),
  })

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => api.markPaidExpense(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Expense marked as paid') },
    onError: (err: Error) => toast.error(err.message),
  })

  const bulkActionMutation = useMutation({
    mutationFn: ({ ids, action, reason }: { ids: string[]; action: string; reason?: string }) =>
      api.bulkActionExpense(ids, action, reason),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      setSelectedIds(new Set())
      setShowBulkActionDialog(null)
      toast.success(result.message || 'Bulk action completed')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const bulkUploadMutation = useMutation({
    mutationFn: (data: FormData) =>
      fetch('/api/expenses/bulk-upload', { method: 'POST', body: data }).then(async res => {
        if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Upload failed' })); throw new Error(err.error || 'Upload failed') }
        return res.json()
      }),
    onSuccess: (result: { success: number; errors: { row: number; field: string; message: string }[] }) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      setUploadResults(result)
      if (result.errors.length === 0) {
        toast.success(`${result.success} expenses uploaded successfully`)
      } else {
        toast.warning(`${result.success} created, ${result.errors.length} errors`)
      }
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Form helpers
  const openCreateForm = useCallback(() => {
    setEditingExpense(null)
    setForm({
      siteId: '', categoryId: '', amount: '', description: '', expenseDate: new Date().toISOString().split('T')[0],
      sellerName: '', invoiceNumber: '', paymentMethod: 'CASH', notes: '', userId: '',
    })
    setFormErrors({})
    setShowFormDialog(true)
  }, [])

  const openEditForm = useCallback((expense: ExpenseItem) => {
    setEditingExpense(expense)
    setForm({
      siteId: expense.siteId, categoryId: expense.categoryId,
      amount: String(expense.amount), description: expense.description,
      expenseDate: new Date(expense.expenseDate).toISOString().split('T')[0],
      sellerName: expense.sellerName || '', invoiceNumber: expense.invoiceNumber || '',
      paymentMethod: expense.paymentMethod, notes: expense.notes || '', userId: expense.userId,
    })
    setFormErrors({})
    setShowFormDialog(true)
  }, [])

  const openResubmitForm = useCallback((expense: ExpenseItem) => {
    setEditingExpense(expense)
    setForm({
      siteId: expense.siteId, categoryId: expense.categoryId,
      amount: String(expense.amount), description: expense.description,
      expenseDate: new Date(expense.expenseDate).toISOString().split('T')[0],
      sellerName: expense.sellerName || '', invoiceNumber: expense.invoiceNumber || '',
      paymentMethod: expense.paymentMethod, notes: expense.notes || '', userId: expense.userId,
    })
    setFormErrors({})
    setShowFormDialog(true)
  }, [])

  const closeFormDialog = useCallback(() => {
    setShowFormDialog(false)
    setEditingExpense(null)
    setFormErrors({})
  }, [])

  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {}
    if (!form.siteId) errors.siteId = 'Site is required'
    if (!form.categoryId) errors.categoryId = 'Category is required'
    if (!form.amount || parseFloat(form.amount) <= 0) errors.amount = 'Valid amount is required'
    if (!form.description.trim()) errors.description = 'Description is required'
    if (!form.expenseDate) errors.expenseDate = 'Expense date is required'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }, [form])

  const handleSubmitForm = useCallback(() => {
    if (!validateForm()) return

    const payload: Record<string, unknown> = {
      siteId: form.siteId,
      categoryId: form.categoryId,
      amount: parseFloat(form.amount),
      description: form.description.trim(),
      expenseDate: form.expenseDate,
      paymentMethod: form.paymentMethod,
      sellerName: form.sellerName.trim() || null,
      invoiceNumber: form.invoiceNumber.trim() || null,
      notes: form.notes.trim() || null,
    }

    if (canViewAll && form.userId) {
      payload.userId = form.userId
    }

    if (editingExpense) {
      if (editingExpense.status === 'RETURNED') {
        resubmitMutation.mutate({ id: editingExpense.id, data: payload })
      } else {
        updateMutation.mutate({ id: editingExpense.id, data: payload })
      }
    } else {
      createMutation.mutate(payload)
    }
  }, [form, editingExpense, validateForm, canViewAll, createMutation, updateMutation, resubmitMutation])

  // Selection helpers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (!expensesData?.data) return
    const data = expensesData.data
    if (selectedIds.size === data.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(data.map(e => e.id)))
    }
  }, [expensesData, selectedIds.size])

  // Export helpers
  const handleExportExcel = useCallback(async () => {
    try {
      const allFilters = { ...filters, pageSize: '9999' }
      const data = await api.getExpenses(allFilters) as { data: ExpenseItem[] }
      const rows = data.data.map(e => ({
        Date: formatDate(e.expenseDate),
        Description: e.description,
        Site: e.site.name,
        Client: e.site.client?.name || '',
        Category: e.category.name,
        Amount: e.amount,
        'Payment Method': e.paymentMethod,
        Status: e.status,
        'Created By': e.user.name,
        'Seller Name': e.sellerName || '',
        'Invoice #': e.invoiceNumber || '',
        'Late Submission': e.isLateSubmission ? `Yes (${e.daysLate} days)` : 'No',
      }))

      const XLSX = await import('xlsx')
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Expenses')
      XLSX.writeFile(wb, 'expenses-export.xlsx')
      toast.success('Excel exported successfully')
    } catch {
      toast.error('Failed to export Excel')
    }
  }, [filters])

  const handleExportPdf = useCallback(async () => {
    try {
      const allFilters = { ...filters, pageSize: '9999' }
      const data = await api.getExpenses(allFilters) as { data: ExpenseItem[] }
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF({ orientation: 'landscape' })
      doc.setFontSize(16)
      doc.text('S.S. Electricals - Expenses Report', 14, 20)
      doc.setFontSize(10)
      doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 28)

      const rows = data.data.map(e => [
        formatDate(e.expenseDate),
        e.description,
        e.site.name,
        e.category.name,
        `${e.amount.toLocaleString('en-IN')}`,
        e.status,
        e.user.name,
        e.paymentMethod,
      ])

      autoTable(doc, {
        startY: 35,
        head: [['Date', 'Description', 'Site', 'Category', 'Amount (₹)', 'Status', 'User', 'Payment']],
        body: rows,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [15, 23, 42] },
      })

      doc.save('expenses-report.pdf')
      toast.success('PDF exported successfully')
    } catch {
      toast.error('Failed to export PDF')
    }
  }, [filters])

  // Download template
  const handleDownloadTemplate = useCallback(async () => {
    try {
      const blob = await api.getBulkUploadTemplate('expenses')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'expense-bulk-upload-template.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Failed to download template')
    }
  }, [])

  // Upload handler
  const handleBulkUpload = useCallback(() => {
    if (!uploadFile) return
    const formData = new FormData()
    formData.append('file', uploadFile)
    bulkUploadMutation.mutate(formData)
  }, [uploadFile, bulkUploadMutation])

  // Bulk action handler
  const handleBulkAction = useCallback((action: string) => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    const needsReason = action === 'reject' || action === 'return'
    if (needsReason && !reasonText.trim()) {
      toast.error('Reason is required')
      return
    }

    bulkActionMutation.mutate({
      ids,
      action,
      reason: needsReason ? reasonText.trim() : undefined,
    })
  }, [selectedIds, reasonText, bulkActionMutation])

  // Clear filters
  const clearFilters = useCallback(() => {
    setSearch(''); setStatusFilter(''); setSiteFilter(''); setCategoryFilter('')
    setDateFrom(''); setDateTo(''); setAmountFrom(''); setAmountTo('')
    setPage(1)
  }, [])

  const expenses = expensesData?.data || []
  const pagination = expensesData?.pagination || { page: 1, pageSize: 20, total: 0, totalPages: 0 }
  const hasSelection = selectedIds.size > 0

  // Determine available actions per expense
  const getAvailableActions = useCallback((expense: ExpenseItem) => {
    const actions: { key: string; label: string; icon: React.ReactNode; onClick: () => void; variant?: 'default' | 'destructive' }[] = [
      { key: 'view', label: 'View', icon: <Eye className="w-4 h-4" />, onClick: () => setViewingExpense(expense) },
    ]

    const isOwner = expense.userId === user?.id
    const editable = ['PENDING', 'RETURNED', 'REJECTED'].includes(expense.status)
    const deletable = ['PENDING', 'REJECTED'].includes(expense.status)

    if ((isOwner || canViewAll) && editable && !editingExpense) {
      actions.push({ key: 'edit', label: 'Edit', icon: <Pencil className="w-4 h-4" />, onClick: () => openEditForm(expense) })
    }

    if (isOwner && expense.status === 'RETURNED') {
      actions.push({ key: 'resubmit', label: 'Resubmit', icon: <Send className="w-4 h-4" />, onClick: () => openResubmitForm(expense) })
    }

    if (canApproveAccountant && expense.status === 'PENDING') {
      actions.push({ key: 'approve-acct', label: 'Approve (Accountant)', icon: <CheckCircle2 className="w-4 h-4" />, onClick: () => approveAcctMutation.mutate(expense.id) })
    }

    if (canApproveAdmin && expense.status === 'ACCOUNTANT_APPROVED') {
      actions.push({ key: 'approve-admin', label: 'Approve (Admin)', icon: <CheckCircle2 className="w-4 h-4" />, onClick: () => approveAdminMutation.mutate(expense.id) })
    }

    if (canMarkPaid && expense.status === 'ADMIN_APPROVED') {
      actions.push({ key: 'mark-paid', label: 'Mark Paid', icon: <Banknote className="w-4 h-4" />, onClick: () => markPaidMutation.mutate(expense.id) })
    }

    if (canRejectOrReturn && ['PENDING', 'ACCOUNTANT_APPROVED', 'ADMIN_APPROVED', 'RETURNED'].includes(expense.status)) {
      actions.push({ key: 'reject', label: 'Reject', icon: <XCircle className="w-4 h-4" />, onClick: () => { setShowRejectDialog(expense.id); setReasonText('') }, variant: 'destructive' })
    }

    if (canRejectOrReturn && ['PENDING', 'ACCOUNTANT_APPROVED'].includes(expense.status)) {
      actions.push({ key: 'return', label: 'Return', icon: <RotateCcw className="w-4 h-4" />, onClick: () => { setShowReturnDialog(expense.id); setReasonText('') } })
    }

    if ((isOwner || canViewAll) && deletable) {
      actions.push({ key: 'delete', label: 'Delete', icon: <Trash2 className="w-4 h-4" />, onClick: () => setShowDeleteDialog(expense.id), variant: 'destructive' })
    }

    return actions
  }, [user, canApproveAccountant, canApproveAdmin, canMarkPaid, canRejectOrReturn, editingExpense, openEditForm, openResubmitForm, approveAcctMutation, approveAdminMutation, markPaidMutation])

  const totalAmount = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-navy-900">{t.expenses}</h2>
          <p className="text-sm text-navy-500">
            {pagination.total} total • {formatCurrency(totalAmount)} total amount
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowFilterBar(!showFilterBar)}>
            <Filter className="w-4 h-4 mr-1" /> {t.filter}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPdf}>
            <Download className="w-4 h-4 mr-1" /> {t.exportPdf}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-1" /> {t.exportExcel}
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setShowBulkUploadDialog(true); setUploadResults(null); setUploadFile(null) }}>
            <Upload className="w-4 h-4 mr-1" /> {t.bulkUpload}
          </Button>
          <Button size="sm" onClick={openCreateForm} className="bg-amber-500 hover:bg-amber-600 text-white">
            <Plus className="w-4 h-4 mr-1" /> Add Expense
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      {showFilterBar && (
        <Card className="rounded-xl border-navy-100">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs text-navy-500 mb-1">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-navy-400" />
                  <Input
                    placeholder="Search descriptions..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1) }}
                    className="pl-9"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-navy-500 mb-1">Status</Label>
                <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1) }}>
                  <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_statuses">All Statuses</SelectItem>
                    {Object.keys(STATUS_CONFIG).map(s => (
                      <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-navy-500 mb-1">Site</Label>
                <Select value={siteFilter} onValueChange={v => { setSiteFilter(v === '__all__' ? '' : v); setPage(1) }}>
                  <SelectTrigger><SelectValue placeholder="All Sites" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Sites</SelectItem>
                    {sites?.data?.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-navy-500 mb-1">Category</Label>
                <Select value={categoryFilter} onValueChange={v => { setCategoryFilter(v === '__all__' ? '' : v); setPage(1) }}>
                  <SelectTrigger><SelectValue placeholder="All Categories" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Categories</SelectItem>
                    {categories?.data?.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-navy-500 mb-1">Date From</Label>
                <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }} />
              </div>
              <div>
                <Label className="text-xs text-navy-500 mb-1">Date To</Label>
                <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }} />
              </div>
              <div>
                <Label className="text-xs text-navy-500 mb-1">Min Amount</Label>
                <Input type="number" placeholder="0" value={amountFrom} onChange={e => { setAmountFrom(e.target.value); setPage(1) }} />
              </div>
              <div>
                <Label className="text-xs text-navy-500 mb-1">Max Amount</Label>
                <Input type="number" placeholder="∞" value={amountTo} onChange={e => { setAmountTo(e.target.value); setPage(1) }} />
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-navy-100">
              <Button variant="ghost" size="sm" onClick={clearFilters}>Clear Filters</Button>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-navy-500">Sort:</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt">Created</SelectItem>
                    <SelectItem value="expenseDate">Expense Date</SelectItem>
                    <SelectItem value="amount">Amount</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="description">Description</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}>
                  <ArrowUpDown className="w-4 h-4" />
                  <span className="text-[10px] ml-0.5">{sortOrder === 'asc' ? 'ASC' : 'DESC'}</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Action Bar */}
      {hasSelection && (
        <Card className="rounded-xl border-amber-300 bg-amber-50">
          <CardContent className="p-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Checkbox checked={selectedIds.size === expenses.length && expenses.length > 0} onCheckedChange={toggleSelectAll} />
              <span className="text-sm font-medium text-amber-900">{selectedIds.size} selected</span>
            </div>
            <div className="flex items-center gap-2">
              {canApproveAccountant && (
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('approve-accountant')} disabled={bulkActionMutation.isPending}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Acct. Approve
                </Button>
              )}
              {canApproveAdmin && (
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('approve-admin')} disabled={bulkActionMutation.isPending}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Admin Approve
                </Button>
              )}
              {canMarkPaid && (
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('mark-paid')} disabled={bulkActionMutation.isPending}>
                  <Banknote className="w-3.5 h-3.5 mr-1" /> Mark Paid
                </Button>
              )}
              {canRejectOrReturn && (
                <Button size="sm" variant="outline" onClick={() => setShowBulkActionDialog('reject')} disabled={bulkActionMutation.isPending}>
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                </Button>
              )}
              {canRejectOrReturn && (
                <Button size="sm" variant="outline" onClick={() => setShowBulkActionDialog('return')} disabled={bulkActionMutation.isPending}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Return
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card className="rounded-xl border-navy-100 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-navy-50/50 hover:bg-navy-50/50">
                  <TableHead className="w-10">
                    <Checkbox checked={selectedIds.size === expenses.length && expenses.length > 0} onCheckedChange={toggleSelectAll} />
                  </TableHead>
                  <TableHead className="text-navy-700 font-semibold text-xs">Date</TableHead>
                  <TableHead className="text-navy-700 font-semibold text-xs">Description</TableHead>
                  <TableHead className="text-navy-700 font-semibold text-xs hidden md:table-cell">Site</TableHead>
                  <TableHead className="text-navy-700 font-semibold text-xs hidden lg:table-cell">Category</TableHead>
                  <TableHead className="text-navy-700 font-semibold text-xs text-right">Amount</TableHead>
                  <TableHead className="text-navy-700 font-semibold text-xs">Status</TableHead>
                  <TableHead className="text-navy-700 font-semibold text-xs w-10">{t.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="w-4 h-4" /></TableCell>
                      <TableCell><Skeleton className="w-20 h-4" /></TableCell>
                      <TableCell><Skeleton className="w-40 h-4" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="w-24 h-4" /></TableCell>
                      <TableCell className="hidden lg:table-cell"><Skeleton className="w-20 h-4" /></TableCell>
                      <TableCell><Skeleton className="w-16 h-4 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="w-20 h-5" /></TableCell>
                      <TableCell><Skeleton className="w-8 h-8" /></TableCell>
                    </TableRow>
                  ))
                ) : expenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-48 text-center">
                      <div className="flex flex-col items-center gap-2 text-navy-400">
                        <ReceiptIcon className="w-12 h-12 stroke-1" />
                        <p className="text-sm">No expenses found</p>
                        <Button variant="outline" size="sm" onClick={openCreateForm}>
                          <Plus className="w-4 h-4 mr-1" /> Create your first expense
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  expenses.map(expense => (
                    <TableRow
                      key={expense.id}
                      className="border-b border-navy-50 hover:bg-amber-50/30 transition-colors"
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(expense.id)}
                          onCheckedChange={() => toggleSelect(expense.id)}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-navy-600 whitespace-nowrap">
                        <div>{formatDate(expense.expenseDate)}</div>
                        {expense.isLateSubmission && (
                          <Badge variant="outline" className="text-[10px] text-red-600 border-red-300 bg-red-50 mt-0.5">
                            <AlertTriangle className="w-2.5 h-2.5 mr-0.5" /> {expense.daysLate}d late
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium text-navy-900 max-w-[200px] truncate">{expense.description}</div>
                        <div className="text-xs text-navy-400">{expense.user.name} • {expense.paymentMethod}</div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="text-sm text-navy-700">{expense.site.name}</div>
                        <div className="text-xs text-navy-400">{expense.site.client?.name || ''}</div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-navy-600">{expense.category.name}</TableCell>
                      <TableCell className="text-right font-semibold text-navy-900 text-sm">{formatCurrency(expense.amount)}</TableCell>
                      <TableCell><StatusBadge status={expense.status} /></TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {getAvailableActions(expense).map(action => (
                              <div key={action.key}>
                                {action.key === 'reject' && <DropdownMenuSeparator />}
                                <DropdownMenuItem onClick={action.onClick} className={`cursor-pointer ${action.variant === 'destructive' ? 'text-red-600 focus:text-red-600' : ''}`}>
                                  {action.icon} {action.label}
                                </DropdownMenuItem>
                              </div>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-navy-100">
              <div className="flex items-center gap-2">
                <span className="text-xs text-navy-500">Rows per page:</span>
                <Select value={pageSize} onValueChange={v => { setPageSize(v); setPage(1) }}>
                  <SelectTrigger className="w-16 h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-navy-600 px-2">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ==================== FORM DIALOG ==================== */}
      <Dialog open={showFormDialog} onOpenChange={closeFormDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-navy-900">
              {editingExpense
                ? editingExpense.status === 'RETURNED' ? 'Resubmit Expense' : 'Edit Expense'
                : 'Add New Expense'}
            </DialogTitle>
            <DialogDescription>
              {editingExpense ? 'Update the expense details below.' : 'Fill in the expense details.'}
            </DialogDescription>
          </DialogHeader>

          {editingExpense?.status === 'RETURNED' && editingExpense.returnReason && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
              <span className="font-medium">Return Reason:</span> {editingExpense.returnReason}
            </div>
          )}

          <div className="space-y-4 py-2">
            {/* User selector for admins */}
            {canViewAll && (
              <div>
                <Label className="text-sm font-medium text-navy-700">User</Label>
                <Select value={form.userId} onValueChange={v => setForm(f => ({ ...f, userId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select user (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={user?.id || ''}>Myself</SelectItem>
                    {users?.data?.filter(u => u.id !== user?.id).map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium text-navy-700">Site *</Label>
                <Select value={form.siteId} onValueChange={v => setForm(f => ({ ...f, siteId: v }))}>
                  <SelectTrigger className={`mt-1 ${formErrors.siteId ? 'border-red-400' : ''}`}>
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites?.data?.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.siteId && <p className="text-xs text-red-500 mt-1">{formErrors.siteId}</p>}
              </div>
              <div>
                <Label className="text-sm font-medium text-navy-700">Category *</Label>
                <Select value={form.categoryId} onValueChange={v => setForm(f => ({ ...f, categoryId: v }))}>
                  <SelectTrigger className={`mt-1 ${formErrors.categoryId ? 'border-red-400' : ''}`}>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.data?.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.categoryId && <p className="text-xs text-red-500 mt-1">{formErrors.categoryId}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium text-navy-700">Amount (₹) *</Label>
                <Input
                  type="number" step="0.01" min="0" placeholder="0.00"
                  value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className={`mt-1 ${formErrors.amount ? 'border-red-400' : ''}`}
                />
                {formErrors.amount && <p className="text-xs text-red-500 mt-1">{formErrors.amount}</p>}
              </div>
              <div>
                <Label className="text-sm font-medium text-navy-700">Expense Date *</Label>
                <Input
                  type="date" value={form.expenseDate} onChange={e => setForm(f => ({ ...f, expenseDate: e.target.value }))}
                  className={`mt-1 ${formErrors.expenseDate ? 'border-red-400' : ''}`}
                />
                {formErrors.expenseDate && <p className="text-xs text-red-500 mt-1">{formErrors.expenseDate}</p>}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-navy-700">Description *</Label>
              <Textarea
                placeholder="What was this expense for?"
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className={`mt-1 ${formErrors.description ? 'border-red-400' : ''}`}
                rows={2}
              />
              {formErrors.description && <p className="text-xs text-red-500 mt-1">{formErrors.description}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium text-navy-700">Payment Method</Label>
                <Select value={form.paymentMethod} onValueChange={v => setForm(f => ({ ...f, paymentMethod: v as PaymentMethod }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(pm => (
                      <SelectItem key={pm} value={pm}>{pm}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium text-navy-700">Invoice #</Label>
                <Input
                  placeholder="Optional invoice number"
                  value={form.invoiceNumber} onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-navy-700">Seller Name</Label>
              <Input
                placeholder="Optional seller/vendor name"
                value={form.sellerName} onChange={e => setForm(f => ({ ...f, sellerName: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-navy-700">Notes</Label>
              <Textarea
                placeholder="Additional notes (optional)"
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="mt-1" rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeFormDialog}>{t.cancel}</Button>
            <Button
              onClick={handleSubmitForm}
              disabled={createMutation.isPending || updateMutation.isPending || resubmitMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {(createMutation.isPending || updateMutation.isPending || resubmitMutation.isPending) ? 'Saving...' : editingExpense?.status === 'RETURNED' ? 'Resubmit' : t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== VIEW DETAIL DIALOG ==================== */}
      <Dialog open={!!viewingExpense} onOpenChange={() => setViewingExpense(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {viewingExpense && (
            <>
              <DialogHeader>
                <DialogTitle className="text-navy-900">Expense Details</DialogTitle>
                <DialogDescription>Created {formatDateTime(viewingExpense.createdAt)}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex items-center justify-between">
                  <StatusBadge status={viewingExpense.status} />
                  {viewingExpense.isLateSubmission && (
                    <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">
                      <AlertTriangle className="w-3 h-3 mr-1" /> Late: {viewingExpense.daysLate} days
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-navy-500">Amount</span>
                    <p className="font-semibold text-navy-900 text-lg">{formatCurrency(viewingExpense.amount)}</p>
                  </div>
                  <div>
                    <span className="text-navy-500">Expense Date</span>
                    <p className="font-medium text-navy-900">{formatDate(viewingExpense.expenseDate)}</p>
                  </div>
                  <div>
                    <span className="text-navy-500">Site</span>
                    <p className="font-medium text-navy-900">{viewingExpense.site.name}</p>
                    <p className="text-xs text-navy-400">{viewingExpense.site.client?.name || ''}</p>
                  </div>
                  <div>
                    <span className="text-navy-500">Category</span>
                    <p className="font-medium text-navy-900">{viewingExpense.category.name}</p>
                  </div>
                  <div>
                    <span className="text-navy-500">Payment Method</span>
                    <p className="font-medium text-navy-900">{viewingExpense.paymentMethod}</p>
                  </div>
                  <div>
                    <span className="text-navy-500">Submitted By</span>
                    <p className="font-medium text-navy-900">{viewingExpense.user.name}</p>
                    <p className="text-xs text-navy-400">{viewingExpense.user.email}</p>
                  </div>
                  {viewingExpense.sellerName && (
                    <div>
                      <span className="text-navy-500">Seller</span>
                      <p className="font-medium text-navy-900">{viewingExpense.sellerName}</p>
                    </div>
                  )}
                  {viewingExpense.invoiceNumber && (
                    <div>
                      <span className="text-navy-500">Invoice #</span>
                      <p className="font-medium text-navy-900">{viewingExpense.invoiceNumber}</p>
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-navy-500 text-sm">Description</span>
                  <p className="text-sm text-navy-900 bg-navy-50 rounded-lg p-3 mt-1">{viewingExpense.description}</p>
                </div>

                {viewingExpense.notes && (
                  <div>
                    <span className="text-navy-500 text-sm">Notes</span>
                    <p className="text-sm text-navy-900 bg-navy-50 rounded-lg p-3 mt-1">{viewingExpense.notes}</p>
                  </div>
                )}

                {/* Approval trail */}
                <div className="border-t border-navy-100 pt-3">
                  <h4 className="text-sm font-semibold text-navy-700 mb-2">Approval Trail</h4>
                  <div className="space-y-1.5 text-xs text-navy-600">
                    {viewingExpense.submissionDate && (
                      <div className="flex justify-between">
                        <span>Submitted</span>
                        <span>{formatDateTime(viewingExpense.submissionDate)}</span>
                      </div>
                    )}
                    {viewingExpense.accountantApprovedBy && (
                      <div className="flex justify-between text-green-700">
                        <span>Acct. Approved by {viewingExpense.accountantApprovedBy.name}</span>
                        <span></span>
                      </div>
                    )}
                    {viewingExpense.adminApprovedBy && (
                      <div className="flex justify-between text-green-700">
                        <span>Admin Approved by {viewingExpense.adminApprovedBy.name}</span>
                        <span></span>
                      </div>
                    )}
                    {viewingExpense.rejectionReason && (
                      <div className="bg-red-50 rounded-lg p-2 text-red-700">
                        <span className="font-medium">Rejected: </span>{viewingExpense.rejectionReason}
                      </div>
                    )}
                    {viewingExpense.returnReason && (
                      <div className="bg-orange-50 rounded-lg p-2 text-orange-700">
                        <span className="font-medium">Returned: </span>{viewingExpense.returnReason}
                      </div>
                    )}
                  </div>
                </div>

                {/* Comments */}
                {viewingExpense.comments && viewingExpense.comments.length > 0 && (
                  <div className="border-t border-navy-100 pt-3">
                    <h4 className="text-sm font-semibold text-navy-700 mb-2">Comments ({viewingExpense.comments.length})</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {viewingExpense.comments.map(comment => (
                        <div key={comment.id} className="bg-navy-50 rounded-lg p-2">
                          <div className="flex items-center justify-between text-xs text-navy-500">
                            <span className="font-medium text-navy-700">{comment.user.name}</span>
                            <span>{formatDateTime(comment.createdAt)}</span>
                          </div>
                          <p className="text-sm text-navy-800 mt-1">{comment.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setViewingExpense(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ==================== DELETE DIALOG ==================== */}
      <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => showDeleteDialog && deleteMutation.mutate(showDeleteDialog)}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ==================== REJECT DIALOG ==================== */}
      <Dialog open={!!showRejectDialog} onOpenChange={() => { setShowRejectDialog(null); setReasonText('') }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-navy-900">Reject Expense</DialogTitle>
            <DialogDescription>Please provide a reason for rejection.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection..."
            value={reasonText} onChange={e => setReasonText(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRejectDialog(null); setReasonText('') }}>{t.cancel}</Button>
            <Button
              variant="destructive"
              onClick={() => showRejectDialog && rejectMutation.mutate({ id: showRejectDialog, reason: reasonText })}
              disabled={rejectMutation.isPending || !reasonText.trim()}
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== RETURN DIALOG ==================== */}
      <Dialog open={!!showReturnDialog} onOpenChange={() => { setShowReturnDialog(null); setReasonText('') }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-navy-900">Return Expense</DialogTitle>
            <DialogDescription>Please provide a reason for returning this expense to the submitter.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for returning..."
            value={reasonText} onChange={e => setReasonText(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowReturnDialog(null); setReasonText('') }}>{t.cancel}</Button>
            <Button
              onClick={() => showReturnDialog && returnMutation.mutate({ id: showReturnDialog, reason: reasonText })}
              disabled={returnMutation.isPending || !reasonText.trim()}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {returnMutation.isPending ? 'Returning...' : 'Return'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== BULK ACTION DIALOG ==================== */}
      <Dialog open={!!showBulkActionDialog} onOpenChange={() => { setShowBulkActionDialog(null); setReasonText('') }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-navy-900">
              Bulk {showBulkActionDialog === 'reject' ? 'Reject' : 'Return'}
            </DialogTitle>
            <DialogDescription>
              You are about to {showBulkActionDialog} {selectedIds.size} expense(s). Please provide a reason.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={`Reason for ${showBulkActionDialog}...`}
            value={reasonText} onChange={e => setReasonText(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowBulkActionDialog(null); setReasonText('') }}>{t.cancel}</Button>
            <Button
              variant={showBulkActionDialog === 'reject' ? 'destructive' : 'default'}
              className={showBulkActionDialog === 'return' ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}
              onClick={() => showBulkActionDialog && handleBulkAction(showBulkActionDialog)}
              disabled={bulkActionMutation.isPending || !reasonText.trim()}
            >
              {bulkActionMutation.isPending ? 'Processing...' : `${showBulkActionDialog === 'reject' ? 'Reject' : 'Return'} ${selectedIds.size} expense(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== BULK UPLOAD DIALOG ==================== */}
      <Dialog open={showBulkUploadDialog} onOpenChange={setShowBulkUploadDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-navy-900">{t.bulkUpload}</DialogTitle>
            <DialogDescription>
              Upload an Excel or CSV file with expense data. Download the template first for the correct format.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Button variant="outline" className="w-full" onClick={handleDownloadTemplate}>
              <Download className="w-4 h-4 mr-2" /> Download Template
            </Button>

            <div className="border-2 border-dashed border-navy-200 rounded-lg p-6 text-center hover:border-amber-400 transition-colors">
              <Upload className="w-8 h-8 mx-auto text-navy-400 mb-2" />
              <p className="text-sm text-navy-600">
                {uploadFile ? uploadFile.name : 'Click or drag file here'}
              </p>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={e => setUploadFile(e.target.files?.[0] || null)}
                className="mt-2"
              />
            </div>

            {uploadResults && (
              <div className={`rounded-lg p-3 ${uploadResults.errors.length === 0 ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                <p className="text-sm font-medium text-navy-900">
                  {uploadResults.success} expenses created successfully
                </p>
                {uploadResults.errors.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto">
                    <p className="text-sm text-amber-800 font-medium">{uploadResults.errors.length} errors:</p>
                    {uploadResults.errors.slice(0, 20).map((err, i) => (
                      <p key={i} className="text-xs text-amber-700">Row {err.row}: {err.field} — {err.message}</p>
                    ))}
                    {uploadResults.errors.length > 20 && (
                      <p className="text-xs text-amber-600">...and {uploadResults.errors.length - 20} more errors</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkUploadDialog(false)}>{t.cancel}</Button>
            <Button
              onClick={handleBulkUpload}
              disabled={!uploadFile || bulkUploadMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {bulkUploadMutation.isPending ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
