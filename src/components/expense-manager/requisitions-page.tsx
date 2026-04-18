'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
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
  X,
  Eye,
  Pencil,
  Check,
  CheckCheck,
  Ban,
  RotateCcw,
  ShoppingCart,
  PackageCheck,
  RefreshCw,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Package,
  Minus,
  FileDown,
  Upload,
  Paperclip,
  Download,
  Printer,
  ExternalLink,
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { exportToCSV, exportToXLS, exportToPDF } from '@/lib/export'
import { CommentThread } from '@/components/comment-thread'
import { useLanguage } from '@/hooks/use-language'

const MIR_STATUSES = [
  'PENDING', 'STOCK_MANAGER_APPROVED', 'ADMIN_APPROVED', 'REJECTED', 'RETURNED', 'ORDERED', 'RECEIVED'
]

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  STOCK_MANAGER_APPROVED: 'bg-cyan-100 text-cyan-800',
  ADMIN_APPROVED: 'bg-emerald-100 text-emerald-800',
  ORDERED: 'bg-teal-100 text-teal-800',
  RECEIVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  RETURNED: 'bg-orange-100 text-orange-800',
}

const priorityColors: Record<string, string> = {
  LOW: 'bg-stone-100 text-stone-700',
  MEDIUM: 'bg-blue-100 text-blue-800',
  HIGH: 'bg-amber-100 text-amber-800',
  URGENT: 'bg-red-100 text-red-800',
}

const exportColumns = [
  { key: 'createdAt', label: 'Created', format: (v: any) => v ? new Date(v).toLocaleDateString() : '' },
  { key: 'requiredDate', label: 'Required Date', format: (v: any) => v ? new Date(v).toLocaleDateString() : '' },
  { key: 'title', label: 'Title' },
  { key: 'site', label: 'Site', format: (v: any) => v?.name || '' },
  { key: 'priority', label: 'Priority' },
  { key: 'totalAmount', label: 'Amount (₹)' },
  { key: 'status', label: 'Status' },
  { key: 'user', label: 'Submitted By', format: (v: any) => v?.name || '' },
]

interface BOQItemForm {
  itemName: string
  description: string
  quantity: string
  unit: string
  unitPrice: string
}

const emptyBOQItem: BOQItemForm = { itemName: '', description: '', quantity: '1', unit: 'pcs', unitPrice: '0' }

const ACCEPTED_FILE_TYPES = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.csv'

export function RequisitionsPage() {
  const { user, permissions } = useAuth()
  const [requisitions, setRequisitions] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [filters, setFilters] = useState({
    statuses: [] as string[],
    clientIds: [] as string[],
    siteIds: [] as string[],
    priorities: [] as string[],
    dateFrom: '',
    dateTo: '',
    search: '',
  })
  const [sortField, setSortField] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const [clients, setClients] = useState<any[]>([])
  const [sites, setSites] = useState<any[]>([])

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkLoading, setBulkLoading] = useState(false)

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [viewRequisition, setViewRequisition] = useState<any>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editReq, setEditReq] = useState<any>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<any>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnTarget, setReturnTarget] = useState<any>(null)
  const [returnReason, setReturnReason] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Create form
  const [form, setForm] = useState({
    clientId: '',
    siteId: '',
    title: '',
    description: '',
    requiredDate: '',
    priority: 'MEDIUM',
    notes: '',
  })
  const [boqItems, setBoqItems] = useState<BOQItemForm[]>([{ ...emptyBOQItem }])

  // Edit form
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    requiredDate: '',
    priority: 'MEDIUM',
    notes: '',
  })

  // File upload
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [editAttachmentFile, setEditAttachmentFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  // Filter sites by selected client in form
  const formFilteredSites = form.clientId
    ? sites.filter((s: any) => s.clientId === form.clientId)
    : sites

  const filteredSites = filters.clientIds.length === 0
    ? sites
    : sites.filter((s: any) => filters.clientIds.includes(s.clientId))

  const loadReferenceData = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([api.getClients(), api.getSites()])
      setClients(c || [])
      setSites(s || [])
    } catch { /* handled */ }
  }, [])

  const loadRequisitions = useCallback(async () => {
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
      if (filters.priorities.length) params.priority = filters.priorities.join(',')
      if (filters.dateFrom) params.dateFrom = filters.dateFrom
      if (filters.dateTo) params.dateTo = filters.dateTo
      if (filters.search) params.search = filters.search

      const result = await api.getRequisitions(params)
      setRequisitions(result.data || [])
      setTotal(result.total || 0)
    } catch { /* handled */ }
    finally { setLoading(false) }
  }, [page, limit, filters, sortField, sortDir])

  useEffect(() => { loadReferenceData() }, [loadReferenceData])
  useEffect(() => { loadRequisitions() }, [loadRequisitions])

  const totalPages = Math.ceil(total / limit)
  const isStockManager = user?.role === 'STOCK_MANAGER'
  const isAdmin = user?.role === 'ADMIN'
  const isAccountant = user?.role === 'ACCOUNTANT'

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

  // Bulk selection handlers
  const allSelected = requisitions.length > 0 && selectedIds.length === requisitions.length
  const someSelected = selectedIds.length > 0 && selectedIds.length < requisitions.length

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(requisitions.map((r: any) => r.id))
    }
  }

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const clearSelection = () => {
    setSelectedIds([])
  }

  const handleBulkAction = async (action: string, actionLabel: string) => {
    setBulkLoading(true)
    try {
      await api.bulkRequisitionAction(selectedIds, action)
      toast({ title: 'Success', description: `${actionLabel} ${selectedIds.length} item(s)` })
      setSelectedIds([])
      loadRequisitions()
    } catch {
      toast({ title: 'Error', description: `Failed to ${actionLabel.toLowerCase()}`, variant: 'destructive' })
    } finally {
      setBulkLoading(false)
    }
  }

  const updateBOQItem = (index: number, field: keyof BOQItemForm, value: string) => {
    const updated = [...boqItems]
    updated[index] = { ...updated[index], [field]: value }
    setBoqItems(updated)
  }

  const addBOQItem = () => setBoqItems([...boqItems, { ...emptyBOQItem }])
  const removeBOQItem = (index: number) => {
    if (boqItems.length > 1) {
      setBoqItems(boqItems.filter((_, i) => i !== index))
    }
  }

  const calcTotal = () =>
    boqItems.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0), 0)

  const clearFilters = () => {
    setFilters({ statuses: [], clientIds: [], siteIds: [], priorities: [], dateFrom: '', dateTo: '', search: '' })
    setPage(1)
  }

  const hasActiveFilters = Object.values(filters).some((v) =>
    Array.isArray(v) ? v.length > 0 : v !== ''
  )

  const handleExport = async (type: 'csv' | 'xls' | 'pdf') => {
    setExporting(true)
    const filename = 'material-requests'
    try {
      // Fetch all filtered data
      const params: Record<string, string> = {
        page: '1',
        limit: '9999',
        sort: sortField,
        sortDir,
      }
      if (filters.statuses.length) params.status = filters.statuses.join(',')
      if (filters.clientIds.length) params.clientId = filters.clientIds.join(',')
      if (filters.siteIds.length) params.siteId = filters.siteIds.join(',')
      if (filters.priorities.length) params.priority = filters.priorities.join(',')
      if (filters.dateFrom) params.dateFrom = filters.dateFrom
      if (filters.dateTo) params.dateTo = filters.dateTo
      if (filters.search) params.search = filters.search
      const result = await api.getRequisitions(params)
      const allData = result.data || []
      if (allData.length === 0) {
        toast({ title: 'No data', description: 'No material requests match current filters', variant: 'destructive' })
        return
      }
      if (type === 'csv') {
        exportToCSV(allData, exportColumns as any, filename)
      } else if (type === 'xls') {
        await exportToXLS(allData, exportColumns as any, filename)
      } else if (type === 'pdf') {
        await exportToPDF(allData, exportColumns as any, filename, 'Material Requests')
      }
      toast({ title: 'Exported', description: `${allData.length} material requests exported as ${type.toUpperCase()}` })
    } catch {
      toast({ title: 'Error', description: 'Export failed', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  // Upload helper
  const uploadFile = async (file: File): Promise<{ url: string; fileName: string } | null> => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('session_token') || ''}`,
        },
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Upload failed')
      }
      const data = await res.json()
      return { url: data.url, fileName: data.fileName }
    } catch (error: any) {
      toast({ title: 'Upload Error', description: error.message || 'Failed to upload file', variant: 'destructive' })
      return null
    } finally {
      setUploading(false)
    }
  }

  const handleCreate = async () => {
    if (!form.siteId || !form.title || !form.requiredDate) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' })
      return
    }
    setActionLoading(true)
    try {
      let attachmentUrl: string | undefined
      let attachmentName: string | undefined
      if (attachmentFile) {
        const uploaded = await uploadFile(attachmentFile)
        if (uploaded) {
          attachmentUrl = uploaded.url
          attachmentName = uploaded.fileName
        } else {
          setActionLoading(false)
          return
        }
      }
      const items = boqItems.map((item, i) => ({
        ...item,
        quantity: parseFloat(item.quantity) || 0,
        unitPrice: parseFloat(item.unitPrice) || 0,
        totalPrice: (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0),
      }))
      await api.createRequisition({
        ...form,
        boqItems: items,
        totalAmount: calcTotal(),
        ...(attachmentUrl ? { attachmentUrl } : {}),
        ...(attachmentName ? { attachmentName } : {}),
      })
      toast({ title: 'Success', description: 'Material request created' })
      setCreateOpen(false)
      setForm({ clientId: '', siteId: '', title: '', description: '', requiredDate: '', priority: 'MEDIUM', notes: '' })
      setBoqItems([{ ...emptyBOQItem }])
      setAttachmentFile(null)
      loadRequisitions()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  // Edit handlers
  const handleOpenEdit = (r: any) => {
    setEditReq(r)
    setEditForm({
      title: r.title || '',
      description: r.description || '',
      requiredDate: r.requiredDate ? new Date(r.requiredDate).toISOString().split('T')[0] : '',
      priority: r.priority || 'MEDIUM',
      notes: r.notes || '',
    })
    setEditAttachmentFile(null)
    setEditOpen(true)
  }

  const handleEdit = async () => {
    if (!editReq || !editForm.title || !editForm.requiredDate) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' })
      return
    }
    setActionLoading(true)
    try {
      let attachmentUrl: string | undefined
      let attachmentName: string | undefined
      if (editAttachmentFile) {
        const uploaded = await uploadFile(editAttachmentFile)
        if (uploaded) {
          attachmentUrl = uploaded.url
          attachmentName = uploaded.fileName
        } else {
          setActionLoading(false)
          return
        }
      }
      await api.updateRequisition(editReq.id, {
        title: editForm.title,
        description: editForm.description,
        requiredDate: editForm.requiredDate,
        priority: editForm.priority,
        notes: editForm.notes,
        ...(attachmentUrl ? { attachmentUrl } : {}),
        ...(attachmentName ? { attachmentName } : {}),
      })
      toast({ title: 'Success', description: 'Material request updated' })
      setEditOpen(false)
      setEditReq(null)
      setEditAttachmentFile(null)
      loadRequisitions()
    } catch {
      toast({ title: 'Error', description: 'Failed to update requisition', variant: 'destructive' })
    }
    finally { setActionLoading(false) }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast({ title: 'Error', description: 'Please provide a reason', variant: 'destructive' })
      return
    }
    setActionLoading(true)
    try {
      await api.rejectRequisition(rejectTarget.id, rejectReason)
      toast({ title: 'Success', description: 'Requisition rejected' })
      setRejectOpen(false); setRejectReason(''); loadRequisitions()
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
      await api.returnRequisition(returnTarget.id, returnReason)
      toast({ title: 'Success', description: 'Requisition returned' })
      setReturnOpen(false); setReturnReason(''); loadRequisitions()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const handleDelete = async () => {
    setActionLoading(true)
    try {
      await api.deleteRequisition(deleteTarget.id)
      toast({ title: 'Success', description: 'Requisition deleted' })
      setDeleteOpen(false); loadRequisitions()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const actionHandler = async (action: () => Promise<any>, msg: string) => {
    setActionLoading(true)
    try {
      await action()
      toast({ title: 'Success', description: msg })
      loadRequisitions()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const { t } = useLanguage()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Material Requests</h2>
          <p className="text-sm text-stone-500">Manage material requests</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="bg-white hover:bg-stone-50" disabled={exporting}>
                {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
                {exporting ? 'Exporting...' : 'Export'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('csv')} className="cursor-pointer">
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('xls')} className="cursor-pointer">
                Export as Excel (XLS)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')} className="cursor-pointer">
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => setCreateOpen(true)} className="bg-stone-900 hover:bg-stone-800">
            <Plus className="w-4 h-4 mr-2" />
            New MIR
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
                placeholder="Search requisitions..."
                className="h-8 pl-9 text-xs"
                value={filters.search}
                onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1) }}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  Status
                  {filters.statuses.length > 0 && <Badge className="ml-1 h-4 px-1 text-[10px]">{filters.statuses.length}</Badge>}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto w-48">
                {MIR_STATUSES.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => {
                    setFilters({ ...filters, statuses: filters.statuses.includes(s) ? filters.statuses.filter(x => x !== s) : [...filters.statuses, s] })
                    setPage(1)
                  }} className="text-xs cursor-pointer">
                    <Checkbox checked={filters.statuses.includes(s)} className="mr-2" />
                    {s.replace(/_/g, ' ')}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  Client
                  {filters.clientIds.length > 0 && <Badge className="ml-1 h-4 px-1 text-[10px]">{filters.clientIds.length}</Badge>}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto w-48">
                {clients.map((c: any) => (
                  <DropdownMenuItem key={c.id} onClick={() => {
                    setFilters({ ...filters, clientIds: filters.clientIds.includes(c.id) ? filters.clientIds.filter(x => x !== c.id) : [...filters.clientIds, c.id] })
                    setPage(1)
                  }} className="text-xs cursor-pointer">
                    <Checkbox checked={filters.clientIds.includes(c.id)} className="mr-2" />
                    {c.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  Site
                  {filters.siteIds.length > 0 && <Badge className="ml-1 h-4 px-1 text-[10px]">{filters.siteIds.length}</Badge>}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto w-48">
                {filteredSites.map((s: any) => (
                  <DropdownMenuItem key={s.id} onClick={() => {
                    setFilters({ ...filters, siteIds: filters.siteIds.includes(s.id) ? filters.siteIds.filter(x => x !== s.id) : [...filters.siteIds, s.id] })
                    setPage(1)
                  }} className="text-xs cursor-pointer">
                    <Checkbox checked={filters.siteIds.includes(s.id)} className="mr-2" />
                    {s.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  Priority
                  {filters.priorities.length > 0 && <Badge className="ml-1 h-4 px-1 text-[10px]">{filters.priorities.length}</Badge>}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {PRIORITIES.map((p) => (
                  <DropdownMenuItem key={p} onClick={() => {
                    setFilters({ ...filters, priorities: filters.priorities.includes(p) ? filters.priorities.filter(x => x !== p) : [...filters.priorities, p] })
                    setPage(1)
                  }} className="text-xs cursor-pointer">
                    <Checkbox checked={filters.priorities.includes(p)} className="mr-2" />
                    {p}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Input type="date" className="h-8 w-36 text-xs" value={filters.dateFrom}
              onChange={(e) => { setFilters({ ...filters, dateFrom: e.target.value }); setPage(1) }} />
            <Input type="date" className="h-8 w-36 text-xs" value={filters.dateTo}
              onChange={(e) => { setFilters({ ...filters, dateTo: e.target.value }); setPage(1) }} />
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
                <X className="w-3 h-3 mr-1" />Clear
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
                  <TableHead className="text-xs w-10">
                    <Checkbox
                      checked={allSelected}
                      ref={(el) => {
                        if (el) {
                          (el as any).indeterminate = someSelected
                        }
                      }}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="text-xs w-12">
                    S.No.
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer" onClick={() => handleSort('createdAt')}>
                    <div className="flex items-center gap-1">Created <SortIcon field="createdAt" /></div>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer" onClick={() => handleSort('requiredDate')}>
                    <div className="flex items-center gap-1">Required Date <SortIcon field="requiredDate" /></div>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer" onClick={() => handleSort('title')}>
                    <div className="flex items-center gap-1">Title <SortIcon field="title" /></div>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer" onClick={() => handleSort('site.name')}>
                    <div className="flex items-center gap-1">Site <SortIcon field="site.name" /></div>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer" onClick={() => handleSort('priority')}>
                    <div className="flex items-center gap-1">Priority <SortIcon field="priority" /></div>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer" onClick={() => handleSort('totalAmount')}>
                    <div className="flex items-center gap-1">Amount <SortIcon field="totalAmount" /></div>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-1">Status <SortIcon field="status" /></div>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer" onClick={() => handleSort('user.name')}>
                    <div className="flex items-center gap-1">Submitted By <SortIcon field="user.name" /></div>
                  </TableHead>
                  <TableHead className="text-xs">Receipt</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>{[...Array(12)].map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}</TableRow>
                  ))
                ) : requisitions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-12 text-stone-400 text-sm">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No requisitions found
                    </TableCell>
                  </TableRow>
                ) : (
                  requisitions.map((r: any, index: number) => {
                    const isOwn = r.userId === user?.id
                    return (
                      <TableRow key={r.id} className={selectedIds.includes(r.id) ? 'bg-stone-50' : ''}>
                        <TableCell className="text-xs">
                          <Checkbox
                            checked={selectedIds.includes(r.id)}
                            onCheckedChange={() => toggleSelectRow(r.id)}
                          />
                        </TableCell>
                        <TableCell className="text-xs text-stone-500">
                          {(page - 1) * limit + index + 1}
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.requiredDate ? new Date(r.requiredDate).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="text-xs max-w-[180px] truncate">{r.title}</TableCell>
                        <TableCell className="text-xs">{r.site?.name || '-'}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${priorityColors[r.priority] || ''}`}>
                            {r.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-medium">₹ {r.totalAmount?.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${statusColors[r.status] || ''}`}>
                            {r.status?.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{r.user?.name || '-'}</TableCell>
                        <TableCell className="text-xs">
                          {r.attachmentUrl ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                                  title={r.attachmentName || 'View attachment'}
                                >
                                  <Paperclip className="w-3 h-3" />
                                  <span className="max-w-[80px] truncate">{r.attachmentName || 'View'}</span>
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem asChild>
                                  <a href={r.attachmentUrl} target="_blank" rel="noopener noreferrer" className="cursor-pointer">
                                    <ExternalLink className="w-3.5 h-3.5 mr-2" />
                                    Open
                                  </a>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <a href={r.attachmentUrl} download={r.attachmentName || undefined} rel="noopener noreferrer" className="cursor-pointer">
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
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => { setViewRequisition(r); setViewOpen(true) }}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>

                            {isAdmin && r.status !== 'RECEIVED' && r.status !== 'REJECTED' && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-stone-500 hover:text-amber-600"
                                onClick={() => handleOpenEdit(r)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            )}

                            {isOwn && r.status === 'RETURNED' && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-stone-500 hover:text-amber-600"
                                onClick={() => handleOpenEdit(r)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            )}

                            {isStockManager && r.status === 'PENDING' && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-stone-500 hover:text-cyan-600"
                                onClick={() => actionHandler(() => api.approveStockManager(r.id), 'Approved by stock manager')} disabled={actionLoading}>
                                <Check className="w-3.5 h-3.5" />
                              </Button>
                            )}

                            {isAdmin && r.status === 'STOCK_MANAGER_APPROVED' && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-stone-500 hover:text-emerald-600"
                                onClick={() => actionHandler(() => api.approveAdminRequisition(r.id), 'Approved by admin')} disabled={actionLoading}>
                                <CheckCheck className="w-3.5 h-3.5" />
                              </Button>
                            )}

                            {(isStockManager || isAdmin) && (r.status === 'PENDING' || r.status === 'STOCK_MANAGER_APPROVED') && (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-stone-500 hover:text-red-600"
                                  onClick={() => { setRejectTarget(r); setRejectOpen(true) }}>
                                  <Ban className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-stone-500 hover:text-orange-600"
                                  onClick={() => { setReturnTarget(r); setReturnOpen(true) }}>
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}

                            {isAdmin && r.status === 'ADMIN_APPROVED' && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-stone-500 hover:text-teal-600"
                                onClick={() => actionHandler(() => api.orderRequisition(r.id), 'Marked as ordered')} disabled={actionLoading}>
                                <ShoppingCart className="w-3.5 h-3.5" />
                              </Button>
                            )}

                            {(isAdmin || isStockManager) && r.status === 'ORDERED' && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-stone-500 hover:text-green-600"
                                onClick={() => actionHandler(() => api.receiveRequisition(r.id), 'Marked as received')} disabled={actionLoading}>
                                <PackageCheck className="w-3.5 h-3.5" />
                              </Button>
                            )}

                            {isOwn && r.status === 'RETURNED' && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-stone-500 hover:text-blue-600">
                                <RefreshCw className="w-3.5 h-3.5" />
                              </Button>
                            )}

                            {isOwn && r.status === 'PENDING' && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-stone-500 hover:text-red-600"
                                onClick={() => { setDeleteTarget(r); setDeleteOpen(true) }}>
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
                <Button variant="outline" size="icon" className="h-7 w-7"
                  onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pn: number
                  if (totalPages <= 5) pn = i + 1
                  else if (page <= 3) pn = i + 1
                  else if (page >= totalPages - 2) pn = totalPages - 4 + i
                  else pn = page - 2 + i
                  return (
                    <Button key={pn} variant={page === pn ? 'default' : 'outline'} size="icon"
                      className="h-7 w-7 text-xs" onClick={() => setPage(pn)}>
                      {pn}
                    </Button>
                  )
                })}
                <Button variant="outline" size="icon" className="h-7 w-7"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3 max-w-[95vw] overflow-x-auto">
          <span className="text-sm font-medium">{selectedIds.length} selected</span>
          <div className="w-px h-6 bg-stone-700" />
          {isStockManager && (
            <Button
              size="sm"
              variant="ghost"
              className="text-cyan-300 hover:text-cyan-200 hover:bg-stone-800 h-8 text-xs"
              onClick={() => handleBulkAction('approve-stock-manager', 'Bulk approved by stock manager')}
              disabled={bulkLoading}
            >
              {bulkLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
              Approve (Stock Mgr)
            </Button>
          )}
          {isAdmin && (
            <Button
              size="sm"
              variant="ghost"
              className="text-emerald-300 hover:text-emerald-200 hover:bg-stone-800 h-8 text-xs"
              onClick={() => handleBulkAction('approve-admin', 'Bulk approved by admin')}
              disabled={bulkLoading}
            >
              {bulkLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCheck className="w-3 h-3 mr-1" />}
              Admin Approve
            </Button>
          )}
          {(isStockManager || isAdmin) && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-300 hover:text-red-200 hover:bg-stone-800 h-8 text-xs"
              onClick={() => handleBulkAction('reject', 'Bulk rejected')}
              disabled={bulkLoading}
            >
              {bulkLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Ban className="w-3 h-3 mr-1" />}
              Reject
            </Button>
          )}
          {isAdmin && (
            <Button
              size="sm"
              variant="ghost"
              className="text-teal-300 hover:text-teal-200 hover:bg-stone-800 h-8 text-xs"
              onClick={() => handleBulkAction('order', 'Bulk ordered')}
              disabled={bulkLoading}
            >
              {bulkLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <ShoppingCart className="w-3 h-3 mr-1" />}
              Order
            </Button>
          )}
          <div className="w-px h-6 bg-stone-700" />
          <Button
            size="sm"
            variant="ghost"
            className="text-stone-400 hover:text-white hover:bg-stone-800 h-8 text-xs"
            onClick={clearSelection}
          >
            <X className="w-3 h-3 mr-1" />
            Clear
          </Button>
        </div>
      )}

      {/* Create MIR Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => {
        if (!open) {
          setAttachmentFile(null)
        }
        setCreateOpen(open)
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Material Request</DialogTitle>
            <DialogDescription>Add a new material request with BOQ items</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Client *</Label>
                <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v, siteId: '' })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select client" /></SelectTrigger>
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
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={form.clientId ? 'Select site' : 'Select client first'} /></SelectTrigger>
                  <SelectContent>
                    {formFilteredSites.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input className="h-9 text-sm" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="MIR title..." />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea className="text-sm min-h-[60px]" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the requirement..." />
            </div>
            <div className="space-y-2">
              <Label>Required Date *</Label>
              <Input type="date" className="h-9 text-sm" value={form.requiredDate}
                onChange={(e) => setForm({ ...form, requiredDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea className="text-sm min-h-[60px]" value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." />
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label>Attachment</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-stone-400 transition-colors">
                {attachmentFile ? (
                  <div className="flex items-center gap-2 justify-center">
                    <Paperclip className="w-4 h-4 text-stone-500" />
                    <span className="text-sm text-stone-700 max-w-[200px] truncate">{attachmentFile.name}</span>
                    <span className="text-xs text-stone-400">({(attachmentFile.size / 1024).toFixed(1)}KB)</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700"
                      onClick={() => setAttachmentFile(null)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-8 h-8 mx-auto mb-2 text-stone-400" />
                    <p className="text-xs text-stone-500 mb-2">Upload attachment (max 2MB)</p>
                    <Label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-stone-300 text-xs cursor-pointer hover:bg-stone-50">
                      <Upload className="w-3 h-3" />
                      Choose File
                      <Input
                        type="file"
                        accept={ACCEPTED_FILE_TYPES}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            if (file.size > 2 * 1024 * 1024) {
                              toast({ title: 'Error', description: 'File size must be less than 2MB', variant: 'destructive' })
                              return
                            }
                            setAttachmentFile(file)
                          }
                        }}
                      />
                    </Label>
                    <p className="text-[10px] text-stone-400 mt-2">Images, PDF, DOC, DOCX, XLS, XLSX, CSV</p>
                  </div>
                )}
              </div>
            </div>

            {/* BOQ Items */}
            <div className="space-y-3 border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <Label className="font-medium">BOQ Items</Label>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addBOQItem}>
                  <Plus className="w-3 h-3 mr-1" />Add Item
                </Button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {boqItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-6 sm:grid-cols-12 gap-2 items-start p-2 bg-stone-50 rounded-lg">
                    <div className="col-span-6 sm:col-span-3">
                      <Input className="h-8 text-xs" placeholder="Item name" value={item.itemName}
                        onChange={(e) => updateBOQItem(index, 'itemName', e.target.value)} />
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <Input className="h-8 text-xs" placeholder="Qty" type="number" value={item.quantity}
                        onChange={(e) => updateBOQItem(index, 'quantity', e.target.value)} />
                    </div>
                    <div className="col-span-3 sm:col-span-1">
                      <Input className="h-8 text-xs" placeholder="Unit" value={item.unit}
                        onChange={(e) => updateBOQItem(index, 'unit', e.target.value)} />
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <Input className="h-8 text-xs" placeholder="Unit Price" type="number" value={item.unitPrice}
                        onChange={(e) => updateBOQItem(index, 'unitPrice', e.target.value)} />
                    </div>
                    <div className="col-span-6 sm:col-span-3 flex items-center text-xs font-medium text-stone-600">
                      ₹ {((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0)).toLocaleString()}
                    </div>
                    <div className="col-span-6 sm:col-span-1 flex justify-end">
                      {boqItems.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700"
                          onClick={() => removeBOQItem(index)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-2 border-t">
                <span className="text-sm font-bold">Total: ₹ {calcTotal().toLocaleString()}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={actionLoading || uploading} className="bg-stone-900 hover:bg-stone-800">
              {(actionLoading || uploading) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {uploading ? 'Uploading...' : 'Create MIR'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit MIR Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => {
        if (!open) {
          setEditReq(null)
          setEditAttachmentFile(null)
        }
        setEditOpen(open)
      }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Material Request</DialogTitle>
            <DialogDescription>Update requisition metadata. BOQ items cannot be edited here.</DialogDescription>
          </DialogHeader>
          {editReq && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input className="h-9 text-sm" value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="MIR title..." />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea className="text-sm min-h-[60px]" value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Describe the requirement..." />
              </div>
              <div className="space-y-2">
                <Label>Required Date *</Label>
                <Input type="date" className="h-9 text-sm" value={editForm.requiredDate}
                  onChange={(e) => setEditForm({ ...editForm, requiredDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={editForm.priority} onValueChange={(v) => setEditForm({ ...editForm, priority: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea className="text-sm min-h-[60px]" value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Additional notes..." />
              </div>

              {/* File Upload for Edit */}
              <div className="space-y-2">
                <Label>Attachment</Label>
                {editReq.attachmentName && !editAttachmentFile && (
                  <div className="flex items-center gap-2 mb-2 p-2 bg-stone-50 rounded-md">
                    <Paperclip className="w-4 h-4 text-stone-500" />
                    <span className="text-sm text-stone-700 truncate flex-1">{editReq.attachmentName}</span>
                    {editReq.attachmentUrl && (
                      <a href={editReq.attachmentUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                        <ExternalLink className="w-3 h-3" />
                        Open
                      </a>
                    )}
                    {editReq.attachmentUrl && (
                      <a href={editReq.attachmentUrl} download={editReq.attachmentName || undefined} rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                        <Download className="w-3 h-3" />
                        Download
                      </a>
                    )}
                  </div>
                )}
                <div className="border-2 border-dashed rounded-lg p-3 text-center hover:border-stone-400 transition-colors">
                  {editAttachmentFile ? (
                    <div className="flex items-center gap-2 justify-center">
                      <Paperclip className="w-4 h-4 text-stone-500" />
                      <span className="text-sm text-stone-700 max-w-[200px] truncate">{editAttachmentFile.name}</span>
                      <span className="text-xs text-stone-400">({(editAttachmentFile.size / 1024).toFixed(1)}KB)</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700"
                        onClick={() => setEditAttachmentFile(null)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <Label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-stone-300 text-xs cursor-pointer hover:bg-stone-50">
                        <Upload className="w-3 h-3" />
                        Replace Attachment
                        <Input
                          type="file"
                          accept={ACCEPTED_FILE_TYPES}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              if (file.size > 2 * 1024 * 1024) {
                                toast({ title: 'Error', description: 'File size must be less than 2MB', variant: 'destructive' })
                                return
                              }
                              setEditAttachmentFile(file)
                            }
                          }}
                        />
                      </Label>
                      <p className="text-[10px] text-stone-400 mt-2">Max 2MB: Images, PDF, DOC, DOCX, XLS, XLSX, CSV</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={actionLoading || uploading} className="bg-stone-900 hover:bg-stone-800">
              {(actionLoading || uploading) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {uploading ? 'Uploading...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View MIR Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>Requisition Details</DialogTitle>
            <Button variant="outline" size="sm" className="print:hidden" onClick={handlePrint}>
              <Printer className="w-3.5 h-3.5 mr-1" />
              Print
            </Button>
          </DialogHeader>
          {viewRequisition && (
            <div id="print-area" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-stone-500 text-xs">Title</span>
                  <p className="font-medium">{viewRequisition.title}</p>
                </div>
                <div>
                  <span className="text-stone-500 text-xs">Status</span>
                  <div className="mt-1">
                    <Badge className={`text-[10px] ${statusColors[viewRequisition.status] || ''}`}>
                      {viewRequisition.status?.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-stone-500 text-xs">Priority</span>
                  <div className="mt-1">
                    <Badge className={`text-[10px] ${priorityColors[viewRequisition.priority] || ''}`}>
                      {viewRequisition.priority}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="text-stone-500 text-xs">Total Amount</span>
                  <p className="font-medium">₹ {viewRequisition.totalAmount?.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-stone-500 text-xs">Site</span>
                  <p className="font-medium">{viewRequisition.site?.name || '-'}</p>
                </div>
                <div>
                  <span className="text-stone-500 text-xs">Submitted By</span>
                  <p className="font-medium">{viewRequisition.user?.name || '-'}</p>
                </div>
                <div>
                  <span className="text-stone-500 text-xs">Required Date</span>
                  <p className="font-medium">{viewRequisition.requiredDate ? new Date(viewRequisition.requiredDate).toLocaleDateString() : '-'}</p>
                </div>
                <div>
                  <span className="text-stone-500 text-xs">Created</span>
                  <p className="font-medium">{viewRequisition.createdAt ? new Date(viewRequisition.createdAt).toLocaleDateString() : '-'}</p>
                </div>
              </div>
              {viewRequisition.description && (
                <div className="text-sm">
                  <span className="text-stone-500 text-xs">Description</span>
                  <p className="font-medium mt-1">{viewRequisition.description}</p>
                </div>
              )}
              {viewRequisition.notes && (
                <div className="text-sm">
                  <span className="text-stone-500 text-xs">Notes</span>
                  <p className="font-medium mt-1">{viewRequisition.notes}</p>
                </div>
              )}
              {viewRequisition.attachmentName && (
                <div className="text-sm">
                  <span className="text-stone-500 text-xs">Attachment</span>
                  <div className="mt-1">
                    {viewRequisition.attachmentUrl ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            <Paperclip className="w-4 h-4" />
                            {viewRequisition.attachmentName}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem asChild>
                            <a href={viewRequisition.attachmentUrl} target="_blank" rel="noopener noreferrer" className="cursor-pointer">
                              <ExternalLink className="w-3.5 h-3.5 mr-2" />
                              Open
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a href={viewRequisition.attachmentUrl} download={viewRequisition.attachmentName || undefined} rel="noopener noreferrer" className="cursor-pointer">
                              <Download className="w-3.5 h-3.5 mr-2" />
                              Download
                            </a>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-stone-600">
                        <Paperclip className="w-4 h-4" />
                        {viewRequisition.attachmentName}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {(viewRequisition.rejectionReason || viewRequisition.returnReason) && (
                <div className="bg-red-50 p-3 rounded-lg text-sm">
                  {viewRequisition.rejectionReason && (
                    <p><span className="font-medium text-red-800">Rejection: </span>{viewRequisition.rejectionReason}</p>
                  )}
                  {viewRequisition.returnReason && (
                    <p><span className="font-medium text-orange-800">Return: </span>{viewRequisition.returnReason}</p>
                  )}
                </div>
              )}

              {/* BOQ Items Table */}
              {viewRequisition.boqItems && viewRequisition.boqItems.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">BOQ Items</h4>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Item</TableHead>
                          <TableHead className="text-xs">Description</TableHead>
                          <TableHead className="text-xs">Qty</TableHead>
                          <TableHead className="text-xs">Unit</TableHead>
                          <TableHead className="text-xs">Unit Price</TableHead>
                          <TableHead className="text-xs">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewRequisition.boqItems.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-xs">{item.itemName}</TableCell>
                            <TableCell className="text-xs max-w-[150px] truncate">{item.description || '-'}</TableCell>
                            <TableCell className="text-xs">{item.quantity}</TableCell>
                            <TableCell className="text-xs">{item.unit}</TableCell>
                            <TableCell className="text-xs">₹ {item.unitPrice?.toLocaleString()}</TableCell>
                            <TableCell className="text-xs font-medium">₹ {item.totalPrice?.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
              {/* Comments Thread */}
              <CommentThread entityType="REQUISITION" entityId={viewRequisition.id} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Requisition</DialogTitle>
            <DialogDescription>Please provide a reason</DialogDescription>
          </DialogHeader>
          <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter rejection reason..." className="min-h-[100px]" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={actionLoading}>
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Return Requisition</DialogTitle>
            <DialogDescription>Please provide a reason</DialogDescription>
          </DialogHeader>
          <Textarea value={returnReason} onChange={(e) => setReturnReason(e.target.value)}
            placeholder="Enter return reason..." className="min-h-[100px]" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(false)}>Cancel</Button>
            <Button onClick={handleReturn} disabled={actionLoading} className="bg-orange-600 hover:bg-orange-700">
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Requisition</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={actionLoading} className="bg-destructive hover:bg-destructive/90">
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
