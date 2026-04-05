'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Plus,
  Search,
  Filter,
  X,
  Eye,
  Pencil,
  Check,
  CheckCheck,
  Ban,
  RotateCcw,
  Banknote,
  RefreshCw,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  IndianRupee,
  Download,
  FileSpreadsheet,
  FileDown,
  Upload,
  Paperclip,
  Printer,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react'
import { exportToCSV, exportToXLS, exportToPDF } from '@/lib/export'
import { CommentThread } from '@/components/comment-thread'
import { useLanguage } from '@/hooks/use-language'

const EXPENSE_STATUSES = [
  'PENDING', 'ACCOUNTANT_APPROVED', 'ADMIN_APPROVED', 'REJECTED', 'RETURNED', 'PAID'
]

const PAYMENT_METHODS = ['CASH', 'UPI', 'CREDIT', 'OFFICE']

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  ACCOUNTANT_APPROVED: 'bg-cyan-100 text-cyan-800',
  ADMIN_APPROVED: 'bg-emerald-100 text-emerald-800',
  PAID: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  RETURNED: 'bg-orange-100 text-orange-800',
}

interface Filters {
  statuses: string[]
  clientIds: string[]
  siteIds: string[]
  categoryIds: string[]
  paymentMethods: string[]
  dateFrom: string
  dateTo: string
  amountMin: string
  amountMax: string
  lateOnly: boolean
  search: string
}

const defaultFilters: Filters = {
  statuses: [],
  clientIds: [],
  siteIds: [],
  categoryIds: [],
  paymentMethods: [],
  dateFrom: '',
  dateTo: '',
  amountMin: '',
  amountMax: '',
  lateOnly: false,
  search: '',
}

const exportColumns = [
  { key: 'expenseDate', label: 'Expense Date', format: (v: any) => v ? new Date(v).toLocaleDateString() : '' },
  { key: 'submissionDate', label: 'Submitted', format: (v: any) => v ? new Date(v).toLocaleDateString() : '' },
  { key: 'description', label: 'Description' },
  { key: 'site', label: 'Site', format: (v: any) => v?.name || '' },
  { key: 'category', label: 'Category', format: (v: any) => v?.name || '' },
  { key: 'amount', label: 'Amount (₹)' },
  { key: 'status', label: 'Status' },
  { key: 'user', label: 'Submitted By', format: (v: any) => v?.name || '' },
  { key: 'paymentMethod', label: 'Payment' },
  { key: 'isLateSubmission', label: 'Late', format: (v: any) => v ? 'Yes' : 'No' },
]

const TOTAL_COLUMNS = 14 // checkbox + S.No + 10 data columns + receipt + actions

const ACCEPTED_FILE_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
]

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (val: string[]) => void
}) {
  const toggle = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((v) => v !== val))
    } else {
      onChange([...selected, val])
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs">
          {label}
          {selected.length > 0 && (
            <Badge className="ml-1 h-4 px-1 text-[10px]">{selected.length}</Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto w-48">
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => toggle(opt.value)}
            className="text-xs cursor-pointer"
          >
            <Checkbox checked={selected.includes(opt.value)} className="mr-2" />
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ExpensesPage() {
  const { user, permissions } = useAuth()
  const [expenses, setExpenses] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [filters, setFilters] = useState<Filters>(defaultFilters)
  const [sortField, setSortField] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Reference data
  const [clients, setClients] = useState<any[]>([])
  const [sites, setSites] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkActionLoading, setBulkActionLoading] = useState(false)

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [viewExpense, setViewExpense] = useState<any>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editExpense, setEditExpense] = useState<any>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<any>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnTarget, setReturnTarget] = useState<any>(null)
  const [returnReason, setReturnReason] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const { t } = useLanguage()

  // Duplicate detection
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)

  // Create form
  const [form, setForm] = useState({
    clientId: '',
    siteId: '',
    categoryId: '',
    amount: '',
    description: '',
    expenseDate: new Date().toISOString().slice(0, 10),
    sellerName: '',
    invoiceNumber: '',
    paymentMethod: 'CASH',
    notes: '',
  })

  // File upload states for create
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  // File upload ref for create dialog
  const createFileInputRef = useRef<HTMLInputElement>(null)

  // Edit form state
  const [editForm, setEditForm] = useState({
    description: '',
    amount: '',
    expenseDate: '',
    sellerName: '',
    invoiceNumber: '',
    paymentMethod: '',
    notes: '',
  })
  const [editReceiptFile, setEditReceiptFile] = useState<File | null>(null)
  const [editUploading, setEditUploading] = useState(false)
  const editFileInputRef = useRef<HTMLInputElement>(null)

  // Filter sites by selected client in form
  const formFilteredSites = form.clientId
    ? sites.filter((s: any) => s.clientId === form.clientId)
    : sites

  const filteredSites = filters.clientIds.length === 0
    ? sites
    : sites.filter((s: any) => filters.clientIds.includes(s.clientId))

  const loadReferenceData = useCallback(async () => {
    try {
      const [c, s, cat] = await Promise.all([
        api.getClients(),
        api.getSites(),
        api.getCategories(),
      ])
      setClients(c || [])
      setSites(s || [])
      setCategories(cat || [])
    } catch { /* handled */ }
  }, [])

  const loadExpenses = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {
        page: page.toString(),
        limit: limit.toString(),
        sort: sortField,
        sortDir,
      }
      if (filters.statuses.length) params.status = filters.statuses.join(',')
      if (filters.clientIds.length) params.clientId = filters.clientIds.join(',')
      if (filters.siteIds.length) params.siteId = filters.siteIds.join(',')
      if (filters.categoryIds.length) params.categoryId = filters.categoryIds.join(',')
      if (filters.paymentMethods.length) params.paymentMethod = filters.paymentMethods.join(',')
      if (filters.dateFrom) params.dateFrom = filters.dateFrom
      if (filters.dateTo) params.dateTo = filters.dateTo
      if (filters.amountMin) params.amountMin = filters.amountMin
      if (filters.amountMax) params.amountMax = filters.amountMax
      if (filters.lateOnly) params.lateOnly = 'true'
      if (filters.search) params.search = filters.search

      const result = await api.getExpenses(params)
      setExpenses(result.data || [])
      setTotal(result.total || 0)
      setSelectedIds(new Set())
    } catch { /* handled */ }
    finally {
      setLoading(false)
    }
  }, [page, limit, filters, sortField, sortDir])

  useEffect(() => {
    loadReferenceData()
  }, [loadReferenceData])

  useEffect(() => {
    loadExpenses()
  }, [loadExpenses])

  const totalPages = Math.ceil(total / limit)

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
    setPage(1)
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ChevronUp className="w-3 h-3 opacity-20" />
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
  }

  const clearFilters = () => {
    setFilters(defaultFilters)
    setPage(1)
  }

  const hasActiveFilters = Object.entries(filters).some(([k, v]) => {
    if (k === 'lateOnly') return v
    if (Array.isArray(v)) return v.length > 0
    return v !== ''
  })

  // Bulk selection helpers
  const allVisibleSelected = expenses.length > 0 && expenses.every((e: any) => selectedIds.has(e.id))
  const someSelected = expenses.some((e: any) => selectedIds.has(e.id)) && !allVisibleSelected

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(expenses.map((e: any) => e.id)))
    }
  }

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  // Bulk action handler
  const handleBulkAction = async (action: string) => {
    if (selectedIds.size === 0) return

    if (action === 'reject' || action === 'return') {
      toast({
        title: 'Not supported',
        description: 'Bulk reject/return requires a reason. Use individual actions.',
        variant: 'destructive',
      })
      return
    }

    setBulkActionLoading(true)
    try {
      const result = await api.bulkExpenseAction(Array.from(selectedIds), action)
      if (result.success) {
        toast({
          title: 'Bulk Action Complete',
          description: `${result.updatedCount || selectedIds.size} expense(s) processed successfully.`,
        })
      } else {
        toast({
          title: 'Partial Success',
          description: `${result.updatedCount} of ${result.totalRequested} processed. ${result.errors?.length ? 'Some errors: ' + result.errors.join(', ') : ''}`,
          variant: 'destructive',
        })
      }
      setSelectedIds(new Set())
      loadExpenses()
    } catch {
      toast({
        title: 'Error',
        description: 'Bulk action failed. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setBulkActionLoading(false)
    }
  }

  // Export all filtered data
  const fetchAllFilteredExpenses = async (): Promise<any[]> => {
    const params: Record<string, string> = {
      page: '1',
      limit: '9999',
      sort: sortField,
      sortDir,
    }
    if (filters.statuses.length) params.status = filters.statuses.join(',')
    if (filters.clientIds.length) params.clientId = filters.clientIds.join(',')
    if (filters.siteIds.length) params.siteId = filters.siteIds.join(',')
    if (filters.categoryIds.length) params.categoryId = filters.categoryIds.join(',')
    if (filters.paymentMethods.length) params.paymentMethod = filters.paymentMethods.join(',')
    if (filters.dateFrom) params.dateFrom = filters.dateFrom
    if (filters.dateTo) params.dateTo = filters.dateTo
    if (filters.amountMin) params.amountMin = filters.amountMin
    if (filters.amountMax) params.amountMax = filters.amountMax
    if (filters.lateOnly) params.lateOnly = 'true'
    if (filters.search) params.search = filters.search
    try {
      const result = await api.getExpenses(params)
      return result.data || []
    } catch {
      return []
    }
  }

  const handleExportCSV = async () => {
    setExporting(true)
    try {
      const allData = await fetchAllFilteredExpenses()
      if (allData.length === 0) {
        toast({ title: 'No data', description: 'No expenses match current filters', variant: 'destructive' })
        return
      }
      exportToCSV(allData, exportColumns, `expenses-${new Date().toISOString().slice(0, 10)}`)
      toast({ title: 'Exported', description: `${allData.length} expenses exported as CSV` })
    } catch {
      toast({ title: 'Error', description: 'Export failed', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  const handleExportXLS = async () => {
    setExporting(true)
    try {
      const allData = await fetchAllFilteredExpenses()
      if (allData.length === 0) {
        toast({ title: 'No data', description: 'No expenses match current filters', variant: 'destructive' })
        return
      }
      await exportToXLS(allData, exportColumns, `expenses-${new Date().toISOString().slice(0, 10)}`)
      toast({ title: 'Exported', description: `${allData.length} expenses exported as Excel` })
    } catch {
      toast({ title: 'Error', description: 'Export failed', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  const handleExportPDF = async () => {
    setExporting(true)
    try {
      const allData = await fetchAllFilteredExpenses()
      if (allData.length === 0) {
        toast({ title: 'No data', description: 'No expenses match current filters', variant: 'destructive' })
        return
      }
      await exportToPDF(allData, exportColumns, `expenses-${new Date().toISOString().slice(0, 10)}`, 'Expenses Report')
      toast({ title: 'Exported', description: `${allData.length} expenses exported as PDF` })
    } catch {
      toast({ title: 'Error', description: 'Export failed', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  // Upload helper
  const uploadFile = async (file: File): Promise<{ url: string; fileName: string } | null> => {
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'File too large',
        description: `Maximum file size is 2MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`,
        variant: 'destructive',
      })
      return null
    }
    if (!ACCEPTED_FILE_TYPES.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|gif|webp|pdf|doc|docx|xls|xlsx|csv)$/i)) {
      toast({
        title: 'Invalid file type',
        description: 'Allowed: images, PDF, DOC, DOCX, XLS, XLSX, CSV',
        variant: 'destructive',
      })
      return null
    }
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json()
        toast({ title: 'Upload failed', description: err.error || 'Unknown error', variant: 'destructive' })
        return null
      }
      return await res.json()
    } catch {
      toast({ title: 'Upload failed', description: 'Could not upload file', variant: 'destructive' })
      return null
    }
  }

  // Create handler with file upload
  const handleCreate = async () => {
    if (!form.siteId || !form.categoryId || !form.amount || !form.description || !form.expenseDate) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' })
      return
    }
    setActionLoading(true)
    setUploading(true)
    try {
      let receiptUrl = ''
      let receiptFileName = ''

      if (receiptFile) {
        const uploadResult = await uploadFile(receiptFile)
        if (!uploadResult) {
          setUploading(false)
          setActionLoading(false)
          return
        }
        receiptUrl = uploadResult.url
        receiptFileName = uploadResult.fileName
      }

      await api.createExpense({
        ...form,
        amount: parseFloat(form.amount),
        receiptUrl,
        receiptFileName,
      })
      toast({ title: 'Success', description: 'Expense created successfully' })
      setCreateOpen(false)
      setForm({
        clientId: '', siteId: '', categoryId: '', amount: '', description: '',
        expenseDate: new Date().toISOString().slice(0, 10),
        sellerName: '', invoiceNumber: '', paymentMethod: 'CASH', notes: '',
      })
      setReceiptFile(null)
      if (createFileInputRef.current) createFileInputRef.current.value = ''
      loadExpenses()
    } catch { /* handled */ }
    finally { setActionLoading(false); setUploading(false) }
  }

  // Edit handlers
  const handleOpenEdit = (expense: any) => {
    setEditExpense({ ...expense })
    setEditForm({
      description: expense.description || '',
      amount: expense.amount?.toString() || '',
      expenseDate: expense.expenseDate ? expense.expenseDate.slice(0, 10) : '',
      sellerName: expense.sellerName || '',
      invoiceNumber: expense.invoiceNumber || '',
      paymentMethod: expense.paymentMethod || 'CASH',
      notes: expense.notes || '',
    })
    setEditReceiptFile(null)
    setEditOpen(true)
  }

  const handleEdit = async () => {
    if (!editExpense) return
    if (!editForm.description || !editForm.amount || !editForm.expenseDate) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' })
      return
    }
    setActionLoading(true)
    setEditUploading(true)
    try {
      const updatedData: Record<string, any> = {
        description: editForm.description,
        amount: parseFloat(editForm.amount),
        expenseDate: editForm.expenseDate,
        sellerName: editForm.sellerName,
        invoiceNumber: editForm.invoiceNumber,
        paymentMethod: editForm.paymentMethod,
        notes: editForm.notes,
      }

      if (editReceiptFile) {
        const uploadResult = await uploadFile(editReceiptFile)
        if (!uploadResult) {
          setEditUploading(false)
          setActionLoading(false)
          return
        }
        updatedData.receiptUrl = uploadResult.url
        updatedData.receiptFileName = uploadResult.fileName
      }

      await api.updateExpense(editExpense.id, updatedData)
      toast({ title: 'Success', description: 'Expense updated successfully' })
      setEditOpen(false)
      setEditExpense(null)
      setEditReceiptFile(null)
      if (editFileInputRef.current) editFileInputRef.current.value = ''
      loadExpenses()
    } catch { /* handled */ }
    finally { setActionLoading(false); setEditUploading(false) }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast({ title: 'Error', description: 'Please provide a reason', variant: 'destructive' })
      return
    }
    setActionLoading(true)
    try {
      await api.rejectExpense(rejectTarget.id, rejectReason)
      toast({ title: 'Success', description: 'Expense rejected' })
      setRejectOpen(false)
      setRejectReason('')
      loadExpenses()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const handleReturn = async () => {
    if (!returnReason.trim()) {
      toast({ title: 'Error', description: 'Please provide a reason', variant: 'destructive' })
      return
    }
    setActionLoading(true)
    try {
      await api.returnExpense(returnTarget.id, returnReason)
      toast({ title: 'Success', description: 'Expense returned' })
      setReturnOpen(false)
      setReturnReason('')
      loadExpenses()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const handleDelete = async () => {
    setActionLoading(true)
    try {
      await api.deleteExpense(deleteTarget.id)
      toast({ title: 'Success', description: 'Expense deleted' })
      setDeleteOpen(false)
      loadExpenses()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const handleApproveAccountant = async (id: string) => {
    setActionLoading(true)
    try {
      await api.approveAccountant(id)
      toast({ title: 'Success', description: 'Expense approved by accountant' })
      loadExpenses()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const handleApproveAdmin = async (id: string) => {
    setActionLoading(true)
    try {
      await api.approveAdmin(id)
      toast({ title: 'Success', description: 'Expense approved by admin' })
      loadExpenses()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const handleMarkPaid = async (id: string) => {
    setActionLoading(true)
    try {
      await api.markPaid(id)
      toast({ title: 'Success', description: 'Expense marked as paid' })
      loadExpenses()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const canApprove = permissions.canApproveExpenses
  const isAdmin = user?.role === 'ADMIN'
  const isAccountant = user?.role === 'ACCOUNTANT'
  const isStockManager = user?.role === 'STOCK_MANAGER'

  // Determine which bulk actions are available based on role and selected items
  const selectedExpenses = expenses.filter((e: any) => selectedIds.has(e.id))
  const hasPendingItems = selectedExpenses.some((e: any) => e.status === 'PENDING')
  const hasAccountantApprovedItems = selectedExpenses.some((e: any) => e.status === 'ACCOUNTANT_APPROVED')
  const hasAdminApprovedItems = selectedExpenses.some((e: any) => e.status === 'ADMIN_APPROVED')

  // File input change handlers
  const handleCreateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: 'File too large',
          description: `Maximum file size is 2MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`,
          variant: 'destructive',
        })
        return
      }
      setReceiptFile(file)
    }
  }

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: 'File too large',
          description: `Maximum file size is 2MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`,
          variant: 'destructive',
        })
        return
      }
      setEditReceiptFile(file)
    }
  }

  // Duplicate detection: check API when amount, date, and site are set in create form
  const checkDuplicates = useCallback(async () => {
    if (!createOpen || !form.amount || !form.expenseDate || !form.siteId) {
      setDuplicateWarning(null)
      return
    }
    try {
      const result = await api.getExpenses({
        amountMin: form.amount,
        amountMax: form.amount,
        dateFrom: form.expenseDate,
        dateTo: form.expenseDate,
        siteId: form.siteId,
        limit: '5',
      })
      const existing = result.data || []
      if (existing.length > 0) {
        setDuplicateWarning(`Found ${existing.length} similar expense(s) with same amount, date, and site.`)
      } else {
        setDuplicateWarning(null)
      }
    } catch {
      // ignore
    }
  }, [createOpen, form.amount, form.expenseDate, form.siteId])

  useEffect(() => {
    const timer = setTimeout(() => {
      checkDuplicates()
    }, 300)
    return () => clearTimeout(timer)
  }, [checkDuplicates])

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Expenses</h2>
          <p className="text-sm text-stone-500">Manage and track all expenses</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={exporting}>
                {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                {exporting ? 'Exporting...' : 'Export'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCSV}>
                <FileText className="w-4 h-4 mr-2" />
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportXLS}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF}>
                <FileDown className="w-4 h-4 mr-2" />
                Export PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={() => setCreateOpen(true)} className="bg-stone-900 hover:bg-stone-800">
            <Plus className="w-4 h-4 mr-2" />
            New Expense
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <Input
                placeholder="Search expenses..."
                className="h-8 pl-9 text-xs"
                value={filters.search}
                onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1) }}
              />
            </div>

            <MultiSelect
              label="Status"
              options={EXPENSE_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
              selected={filters.statuses}
              onChange={(v) => { setFilters({ ...filters, statuses: v }); setPage(1) }}
            />
            <MultiSelect
              label="Client"
              options={clients.map((c: any) => ({ value: c.id, label: c.name }))}
              selected={filters.clientIds}
              onChange={(v) => { setFilters({ ...filters, clientIds: v, siteIds: [] }); setPage(1) }}
            />
            <MultiSelect
              label="Site"
              options={filteredSites.map((s: any) => ({ value: s.id, label: s.name }))}
              selected={filters.siteIds}
              onChange={(v) => { setFilters({ ...filters, siteIds: v }); setPage(1) }}
            />
            <MultiSelect
              label="Category"
              options={categories.map((c: any) => ({ value: c.id, label: c.name }))}
              selected={filters.categoryIds}
              onChange={(v) => { setFilters({ ...filters, categoryIds: v }); setPage(1) }}
            />
            <MultiSelect
              label="Payment"
              options={PAYMENT_METHODS.map((m) => ({ value: m, label: m.replace(/_/g, ' ') }))}
              selected={filters.paymentMethods}
              onChange={(v) => { setFilters({ ...filters, paymentMethods: v }); setPage(1) }}
            />

            <Input
              type="date"
              className="h-8 w-36 text-xs"
              value={filters.dateFrom}
              onChange={(e) => { setFilters({ ...filters, dateFrom: e.target.value }); setPage(1) }}
            />
            <Input
              type="date"
              className="h-8 w-36 text-xs"
              value={filters.dateTo}
              onChange={(e) => { setFilters({ ...filters, dateTo: e.target.value }); setPage(1) }}
            />
            <Input
              type="number"
              placeholder="Min Amt"
              className="h-8 w-24 text-xs"
              value={filters.amountMin}
              onChange={(e) => { setFilters({ ...filters, amountMin: e.target.value }); setPage(1) }}
            />
            <Input
              type="number"
              placeholder="Max Amt"
              className="h-8 w-24 text-xs"
              value={filters.amountMax}
              onChange={(e) => { setFilters({ ...filters, amountMax: e.target.value }); setPage(1) }}
            />

            <div className="flex items-center gap-2">
              <Checkbox
                checked={filters.lateOnly}
                onCheckedChange={(c) => { setFilters({ ...filters, lateOnly: !!c }); setPage(1) }}
              />
              <span className="text-xs text-stone-600">Late only</span>
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
                <X className="w-3 h-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {/* Checkbox column */}
                  <TableHead className="text-xs w-10">
                    <Checkbox
                      checked={allVisibleSelected}
                      ref={(el) => {
                        if (el) {
                          (el as HTMLButtonElement & { indeterminate?: boolean }).dataset.indeterminate = someSelected ? 'true' : 'false'
                        }
                      }}
                      onCheckedChange={toggleSelectAll}
                      className={someSelected && !allVisibleSelected ? 'opacity-70' : ''}
                    />
                  </TableHead>
                  {/* S.No. column */}
                  <TableHead className="text-xs w-12 text-center">S.No.</TableHead>
                  {/* All sortable columns */}
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('expenseDate')}>
                    <div className="flex items-center gap-1">Expense Date <SortIcon field="expenseDate" /></div>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('submissionDate')}>
                    <div className="flex items-center gap-1">Submitted <SortIcon field="submissionDate" /></div>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('description')}>
                    <div className="flex items-center gap-1">Description <SortIcon field="description" /></div>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('site.name')}>
                    <div className="flex items-center gap-1">Site <SortIcon field="site.name" /></div>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('category.name')}>
                    <div className="flex items-center gap-1">Category <SortIcon field="category.name" /></div>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('amount')}>
                    <div className="flex items-center gap-1">Amount <SortIcon field="amount" /></div>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-1">Status <SortIcon field="status" /></div>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('user.name')}>
                    <div className="flex items-center gap-1">Submitted By <SortIcon field="user.name" /></div>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('paymentMethod')}>
                    <div className="flex items-center gap-1">Payment <SortIcon field="paymentMethod" /></div>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('isLateSubmission')}>
                    <div className="flex items-center gap-1">Late <SortIcon field="isLateSubmission" /></div>
                  </TableHead>
                  <TableHead className="text-xs">Receipt</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(TOTAL_COLUMNS)].map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : expenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={TOTAL_COLUMNS} className="text-center py-12 text-stone-400 text-sm">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No expenses found
                    </TableCell>
                  </TableRow>
                ) : (
                  expenses.map((e: any, index: number) => {
                    const isOwn = e.userId === user?.id
                    const isSelected = selectedIds.has(e.id)
                    const sno = (page - 1) * limit + index + 1
                    return (
                      <TableRow key={e.id} className={isSelected ? 'bg-stone-50' : ''}>
                        {/* Checkbox */}
                        <TableCell className="text-xs w-10">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelectOne(e.id)}
                          />
                        </TableCell>
                        {/* S.No. */}
                        <TableCell className="text-xs text-center text-stone-500">{sno}</TableCell>
                        {/* Expense Date */}
                        <TableCell className="text-xs whitespace-nowrap">
                          {e.expenseDate ? new Date(e.expenseDate).toLocaleDateString() : '-'}
                        </TableCell>
                        {/* Submission Date */}
                        <TableCell className="text-xs whitespace-nowrap">
                          {e.submissionDate ? new Date(e.submissionDate).toLocaleDateString() : '-'}
                        </TableCell>
                        {/* Description */}
                        <TableCell className="text-xs max-w-[180px] truncate">{e.description}</TableCell>
                        {/* Site */}
                        <TableCell className="text-xs">{e.site?.name || '-'}</TableCell>
                        {/* Category */}
                        <TableCell className="text-xs">{e.category?.name || '-'}</TableCell>
                        {/* Amount */}
                        <TableCell className="text-xs font-medium whitespace-nowrap">
                          <IndianRupee className="w-3 h-3 inline mr-0.5 -mt-px" />
                          {e.amount?.toLocaleString()}
                        </TableCell>
                        {/* Status */}
                        <TableCell>
                          <Badge className={`text-[10px] ${statusColors[e.status] || ''}`}>
                            {e.status?.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        {/* Submitted By */}
                        <TableCell className="text-xs">{e.user?.name || '-'}</TableCell>
                        {/* Payment */}
                        <TableCell className="text-xs">{e.paymentMethod?.replace(/_/g, ' ') || '-'}</TableCell>
                        {/* Late */}
                        <TableCell className="text-xs">
                          {e.isLateSubmission ? (
                            <Badge className="bg-red-100 text-red-700 text-[10px] font-semibold">
                              LATE{e.daysLate ? ` (${e.daysLate}d)` : ''}
                            </Badge>
                          ) : (
                            <span className="text-green-400 text-sm">—</span>
                          )}
                        </TableCell>
                        {/* Receipt */}
                        <TableCell className="text-xs">
                          {e.receiptUrl ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                                  title={e.receiptFileName || 'View receipt'}
                                >
                                  <Paperclip className="w-3 h-3" />
                                  <span className="max-w-[80px] truncate">{e.receiptFileName || 'View'}</span>
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem asChild>
                                  <a href={e.receiptUrl} target="_blank" rel="noopener noreferrer" className="cursor-pointer">
                                    <ExternalLink className="w-3.5 h-3.5 mr-2" />
                                    Open
                                  </a>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <a href={e.receiptUrl} download={e.receiptFileName || undefined} rel="noopener noreferrer" className="cursor-pointer">
                                    <Download className="w-3.5 h-3.5 mr-2" />
                                    Download
                                  </a>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </TableCell>
                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => { setViewExpense(e); setViewOpen(true) }}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>

                            {/* Edit - Admin: any non-PAID, non-REJECTED */}
                            {isAdmin && e.status !== 'PAID' && e.status !== 'REJECTED' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-stone-500 hover:text-amber-600"
                                onClick={() => handleOpenEdit(e)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            )}

                            {/* Edit - Own RETURNED */}
                            {isOwn && e.status === 'RETURNED' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-stone-500 hover:text-amber-600"
                                onClick={() => handleOpenEdit(e)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            )}

                            {/* Approve - Accountant */}
                            {(isAccountant || isAdmin) && e.status === 'PENDING' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-stone-500 hover:text-cyan-600"
                                onClick={() => handleApproveAccountant(e.id)}
                                disabled={actionLoading}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </Button>
                            )}

                            {/* Admin Approve */}
                            {isAdmin && e.status === 'ACCOUNTANT_APPROVED' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-stone-500 hover:text-emerald-600"
                                onClick={() => handleApproveAdmin(e.id)}
                                disabled={actionLoading}
                              >
                                <CheckCheck className="w-3.5 h-3.5" />
                              </Button>
                            )}

                            {/* Reject / Return */}
                            {(isAccountant || isAdmin) && (e.status === 'PENDING' || e.status === 'ACCOUNTANT_APPROVED') && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-stone-500 hover:text-red-600"
                                  onClick={() => { setRejectTarget(e); setRejectOpen(true) }}
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-stone-500 hover:text-orange-600"
                                  onClick={() => { setReturnTarget(e); setReturnOpen(true) }}
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}

                            {/* Mark Paid */}
                            {(isAccountant || isAdmin) && e.status === 'ADMIN_APPROVED' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-stone-500 hover:text-green-600"
                                onClick={() => handleMarkPaid(e.id)}
                                disabled={actionLoading}
                              >
                                <Banknote className="w-3.5 h-3.5" />
                              </Button>
                            )}

                            {/* Resubmit */}
                            {isOwn && e.status === 'RETURNED' && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-stone-500 hover:text-blue-600">
                                <RefreshCw className="w-3.5 h-3.5" />
                              </Button>
                            )}

                            {/* Delete */}
                            {isOwn && e.status === 'PENDING' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-stone-500 hover:text-red-600"
                                onClick={() => { setDeleteTarget(e); setDeleteOpen(true) }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-stone-500">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (page <= 3) {
                    pageNum = i + 1
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = page - 2 + i
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? 'default' : 'outline'}
                      size="icon"
                      className="h-7 w-7 text-xs"
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  )
                })}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Action Bar - Fixed at bottom when items selected */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-stone-900 text-white shadow-[0_-4px_20px_rgba(0,0,0,0.15)] px-4 sm:px-6 py-3 flex items-center justify-between animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">
              {selectedIds.size} expense{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto max-w-[calc(100vw-2rem)]">
            {/* Bulk approve accountant */}
            {(isAccountant || isAdmin) && hasPendingItems && (
              <Button
                size="sm"
                variant="secondary"
                className="bg-cyan-600 hover:bg-cyan-700 text-white"
                onClick={() => handleBulkAction('approve_accountant')}
                disabled={bulkActionLoading}
              >
                {bulkActionLoading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                <Check className="w-3.5 h-3.5 mr-1.5" />
                Approve (Accountant)
              </Button>
            )}

            {/* Bulk approve admin */}
            {isAdmin && hasAccountantApprovedItems && (
              <Button
                size="sm"
                variant="secondary"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => handleBulkAction('approve_admin')}
                disabled={bulkActionLoading}
              >
                {bulkActionLoading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
                Approve (Admin)
              </Button>
            )}

            {/* Bulk reject */}
            {(isAccountant || isAdmin) && hasPendingItems && (
              <Button
                size="sm"
                variant="secondary"
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  toast({
                    title: 'Use individual reject',
                    description: 'Bulk reject requires a reason. Please reject individually.',
                    variant: 'destructive',
                  })
                }}
                disabled={bulkActionLoading}
              >
                <Ban className="w-3.5 h-3.5 mr-1.5" />
                Reject
              </Button>
            )}

            {/* Bulk mark paid */}
            {(isAccountant || isAdmin) && hasAdminApprovedItems && (
              <Button
                size="sm"
                variant="secondary"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleBulkAction('mark_paid')}
                disabled={bulkActionLoading}
              >
                {bulkActionLoading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                <Banknote className="w-3.5 h-3.5 mr-1.5" />
                Mark Paid
              </Button>
            )}

            {/* Clear selection */}
            <Button
              size="sm"
              variant="ghost"
              className="text-stone-300 hover:text-white hover:bg-stone-800"
              onClick={clearSelection}
            >
              <X className="w-3.5 h-3.5 mr-1.5" />
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Create Expense Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => {
        if (!open) {
          setReceiptFile(null)
          if (createFileInputRef.current) createFileInputRef.current.value = ''
        }
        setCreateOpen(open)
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Expense</DialogTitle>
            <DialogDescription>Add a new expense record</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Duplicate warning */}
            {duplicateWarning && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <p className="font-medium text-amber-800">Possible Duplicate</p>
                  <p className="text-amber-700">{duplicateWarning}</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Client *</Label>
                <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v, siteId: '' })}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Site *</Label>
                <Select value={form.siteId} onValueChange={(v) => setForm({ ...form, siteId: v })}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder={form.clientId ? 'Select site' : 'Select client first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {formFilteredSites.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter((c: any) => c.type === 'EXPENSE' || c.type === 'BOTH').map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">Amount (₹) *</Label>
                <Input
                  type="number"
                  className="h-9 text-sm"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Expense Date *</Label>
                <Input
                  type="date"
                  className="h-9 text-sm"
                  value={form.expenseDate}
                  onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                className="text-sm min-h-[80px]"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe the expense..."
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Seller Name</Label>
                <Input
                  className="h-9 text-sm"
                  value={form.sellerName}
                  onChange={(e) => setForm({ ...form, sellerName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Invoice Number</Label>
                <Input
                  className="h-9 text-sm"
                  value={form.invoiceNumber}
                  onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{m.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                className="text-sm min-h-[60px]"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Additional notes..."
              />
            </div>
            {/* File Upload */}
            <div className="space-y-2">
              <Label>Receipt / Attachment</Label>
              <div className="flex items-center gap-3">
                <input
                  ref={createFileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.csv"
                  onChange={handleCreateFileChange}
                  className="hidden"
                  id="create-receipt-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => createFileInputRef.current?.click()}
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  {receiptFile ? 'Change File' : 'Choose File'}
                </Button>
                {receiptFile && (
                  <div className="flex items-center gap-1.5 text-xs text-stone-600">
                    <Paperclip className="w-3 h-3" />
                    <span className="max-w-[200px] truncate">{receiptFile.name}</span>
                    <span className="text-stone-400">({(receiptFile.size / 1024).toFixed(1)}KB)</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 text-stone-400 hover:text-red-500"
                      onClick={() => {
                        setReceiptFile(null)
                        if (createFileInputRef.current) createFileInputRef.current.value = ''
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-stone-400">Accepted: images, PDF, DOC, DOCX, XLS, XLSX, CSV (max 2MB)</p>
              {uploading && (
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Uploading file...
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={actionLoading || uploading} className="bg-stone-900 hover:bg-stone-800">
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Expense Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => {
        if (!open) {
          setEditExpense(null)
          setEditReceiptFile(null)
          if (editFileInputRef.current) editFileInputRef.current.value = ''
        }
        setEditOpen(open)
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>Update expense details</DialogDescription>
          </DialogHeader>
          {editExpense && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">Amount (₹) *</Label>
                  <Input
                    type="number"
                    className="h-9 text-sm"
                    value={editForm.amount}
                    onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expense Date *</Label>
                  <Input
                    type="date"
                    className="h-9 text-sm"
                    value={editForm.expenseDate}
                    onChange={(e) => setEditForm({ ...editForm, expenseDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea
                  className="text-sm min-h-[80px]"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Describe the expense..."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Seller Name</Label>
                  <Input
                    className="h-9 text-sm"
                    value={editForm.sellerName}
                    onChange={(e) => setEditForm({ ...editForm, sellerName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Invoice Number</Label>
                  <Input
                    className="h-9 text-sm"
                    value={editForm.invoiceNumber}
                    onChange={(e) => setEditForm({ ...editForm, invoiceNumber: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={editForm.paymentMethod} onValueChange={(v) => setEditForm({ ...editForm, paymentMethod: v })}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  className="text-sm min-h-[60px]"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="Additional notes..."
                />
              </div>
              {/* File Upload for Edit */}
              <div className="space-y-2">
                <Label>Receipt / Attachment</Label>
                <div className="flex items-center gap-3">
                  <input
                    ref={editFileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.csv"
                    onChange={handleEditFileChange}
                    className="hidden"
                    id="edit-receipt-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => editFileInputRef.current?.click()}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    {editReceiptFile ? 'Change File' : 'Choose File'}
                  </Button>
                  {editReceiptFile && (
                    <div className="flex items-center gap-1.5 text-xs text-stone-600">
                      <Paperclip className="w-3 h-3" />
                      <span className="max-w-[200px] truncate">{editReceiptFile.name}</span>
                      <span className="text-stone-400">({(editReceiptFile.size / 1024).toFixed(1)}KB)</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-stone-400 hover:text-red-500"
                        onClick={() => {
                          setEditReceiptFile(null)
                          if (editFileInputRef.current) editFileInputRef.current.value = ''
                        }}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
                {!editReceiptFile && editExpense.receiptUrl && (
                  <a
                    href={editExpense.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline bg-blue-50 rounded px-2 py-1.5"
                  >
                    <Paperclip className="w-3 h-3" />
                    <span className="max-w-[200px] truncate">{editExpense.receiptFileName || 'View Current Receipt'}</span>
                    <Download className="w-3 h-3" />
                  </a>
                )}
                {!editReceiptFile && !editExpense.receiptUrl && editExpense.receiptFileName && (
                  <div className="flex items-center gap-1.5 text-xs text-stone-500 bg-stone-50 rounded px-2 py-1.5">
                    <Paperclip className="w-3 h-3" />
                    <span>Current: {editExpense.receiptFileName}</span>
                  </div>
                )}
                <p className="text-[10px] text-stone-400">Accepted: images, PDF, DOC, DOCX, XLS, XLSX, CSV (max 2MB)</p>
                {editUploading && (
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Uploading file...
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={actionLoading || editUploading} className="bg-stone-900 hover:bg-stone-800">
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Expense Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>Expense Details</DialogTitle>
            <Button variant="outline" size="sm" className="print:hidden" onClick={handlePrint}>
              <Printer className="w-3.5 h-3.5 mr-1" />
              Print
            </Button>
          </DialogHeader>
          {viewExpense && (
            <div id="print-area" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-stone-500 text-xs">Description</span>
                  <p className="font-medium">{viewExpense.description}</p>
                </div>
                <div>
                  <span className="text-stone-500 text-xs">Amount</span>
                  <p className="font-medium">
                    <IndianRupee className="w-3.5 h-3.5 inline mr-0.5 -mt-0.5" />
                    {viewExpense.amount?.toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-stone-500 text-xs">Status</span>
                  <Badge className={`text-[10px] mt-1 ${statusColors[viewExpense.status] || ''}`}>
                    {viewExpense.status?.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <div>
                  <span className="text-stone-500 text-xs">Payment Method</span>
                  <p className="font-medium">{viewExpense.paymentMethod?.replace(/_/g, ' ')}</p>
                </div>
                <div>
                  <span className="text-stone-500 text-xs">Expense Date</span>
                  <p className="font-medium">{viewExpense.expenseDate ? new Date(viewExpense.expenseDate).toLocaleDateString() : '-'}</p>
                </div>
                <div>
                  <span className="text-stone-500 text-xs">Submission Date</span>
                  <p className="font-medium">{viewExpense.submissionDate ? new Date(viewExpense.submissionDate).toLocaleDateString() : '-'}</p>
                </div>
                <div>
                  <span className="text-stone-500 text-xs">Site</span>
                  <p className="font-medium">{viewExpense.site?.name || '-'}</p>
                </div>
                <div>
                  <span className="text-stone-500 text-xs">Client</span>
                  <p className="font-medium">{viewExpense.site?.client?.name || '-'}</p>
                </div>
                <div>
                  <span className="text-stone-500 text-xs">Category</span>
                  <p className="font-medium">{viewExpense.category?.name || '-'}</p>
                </div>
                <div>
                  <span className="text-stone-500 text-xs">Submitted By</span>
                  <p className="font-medium">{viewExpense.user?.name || '-'}</p>
                </div>
                <div>
                  <span className="text-stone-500 text-xs">Seller Name</span>
                  <p className="font-medium">{viewExpense.sellerName || '-'}</p>
                </div>
                <div>
                  <span className="text-stone-500 text-xs">Invoice Number</span>
                  <p className="font-medium">{viewExpense.invoiceNumber || '-'}</p>
                </div>
                {viewExpense.isLateSubmission && (
                  <div>
                    <span className="text-stone-500 text-xs">Late Submission</span>
                    <Badge className="bg-red-100 text-red-700 text-[10px] mt-1 font-semibold">
                      LATE{viewExpense.daysLate ? ` (${viewExpense.daysLate} days)` : ''}
                    </Badge>
                  </div>
                )}
              </div>
              {viewExpense.notes && (
                <div className="text-sm">
                  <span className="text-stone-500 text-xs">Notes</span>
                  <p className="font-medium mt-1">{viewExpense.notes}</p>
                </div>
              )}
              {viewExpense.receiptUrl ? (
                <div className="text-sm">
                  <span className="text-stone-500 text-xs">Receipt</span>
                  <a
                    href={viewExpense.receiptUrl}
                    download={viewExpense.receiptFileName || undefined}
                    className="mt-1 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-sm text-blue-600 hover:text-blue-800"
                  >
                    <Paperclip className="w-4 h-4" />
                    <span className="font-medium">{viewExpense.receiptFileName || 'Download Receipt'}</span>
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : viewExpense.receiptFileName ? (
                <div className="text-sm">
                  <span className="text-stone-500 text-xs">Receipt</span>
                  <div className="flex items-center gap-2 mt-1 text-stone-500">
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>{viewExpense.receiptFileName}</span>
                  </div>
                </div>
              ) : null}
              {(viewExpense.rejectionReason || viewExpense.returnReason) && (
                <div className="bg-red-50 p-3 rounded-lg text-sm">
                  {viewExpense.rejectionReason && (
                    <p><span className="font-medium text-red-800">Rejection Reason: </span>{viewExpense.rejectionReason}</p>
                  )}
                  {viewExpense.returnReason && (
                    <p><span className="font-medium text-orange-800">Return Reason: </span>{viewExpense.returnReason}</p>
                  )}
                </div>
              )}
              {/* Comments Thread */}
              <CommentThread entityType="EXPENSE" entityId={viewExpense.id} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Expense</DialogTitle>
            <DialogDescription>Please provide a reason for rejection</DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter rejection reason..."
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={actionLoading}>
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Return Expense</DialogTitle>
            <DialogDescription>Please provide a reason for returning this expense</DialogDescription>
          </DialogHeader>
          <Textarea
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            placeholder="Enter return reason..."
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(false)}>Cancel</Button>
            <Button onClick={handleReturn} disabled={actionLoading} className="bg-orange-600 hover:bg-orange-700">
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={actionLoading} className="bg-destructive hover:bg-destructive/90">
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
