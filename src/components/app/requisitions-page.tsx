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
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  Plus, Search, Eye, Pencil, Trash2, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, RotateCcw, ArrowRightToLine, Package,
  PackageCheck, MoreHorizontal, Filter,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ==================== TYPES ====================
interface BOQItemForm {
  itemName: string
  description: string
  quantity: number
  unit: string
  unitPrice: number
  totalPrice: number
  category: string
  notes: string
}

interface BOQItemData extends BOQItemForm {
  id: string
  requisitionId: string
  createdAt: string
  updatedAt: string
}

interface Requisition {
  id: string
  siteId: string
  userId: string
  title: string
  description: string | null
  requiredDate: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  status: 'PENDING' | 'STOCK_MANAGER_APPROVED' | 'ADMIN_APPROVED' | 'REJECTED' | 'RETURNED' | 'ORDERED' | 'RECEIVED'
  totalAmount: number
  notes: string | null
  attachmentUrl: string | null
  attachmentName: string | null
  rejectionReason: string | null
  returnReason: string | null
  createdAt: string
  updatedAt: string
  site: { id: string; name: string; client: { id: string; name: string } }
  user: { id: string; name: string; email: string }
  stockManagerApprovedBy: { id: string; name: string } | null
  adminApprovedBy: { id: string; name: string } | null
  boqItems: BOQItemData[]
  stockManagerApprovedAt: string | null
  adminApprovedAt: string | null
}

// ==================== HELPERS ====================
const emptyBOQItem = (): BOQItemForm => ({
  itemName: '', description: '', quantity: 1, unit: 'pcs',
  unitPrice: 0, totalPrice: 0, category: '', notes: '',
})

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  LOW: { label: 'Low', className: 'bg-gray-100 text-gray-700 border-gray-300' },
  MEDIUM: { label: 'Medium', className: 'bg-blue-100 text-blue-700 border-blue-300' },
  HIGH: { label: 'High', className: 'bg-amber-100 text-amber-700 border-amber-300' },
  URGENT: { label: 'Urgent', className: 'bg-red-100 text-red-700 border-red-300' },
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Pending', className: 'bg-amber-100 text-amber-700 border-amber-300' },
  STOCK_MANAGER_APPROVED: { label: 'Stock Mgr Approved', className: 'bg-blue-100 text-blue-700 border-blue-300' },
  ADMIN_APPROVED: { label: 'Admin Approved', className: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  ORDERED: { label: 'Ordered', className: 'bg-purple-100 text-purple-700 border-purple-300' },
  RECEIVED: { label: 'Received', className: 'bg-green-100 text-green-700 border-green-300' },
  REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-700 border-red-300' },
  RETURNED: { label: 'Returned', className: 'bg-orange-100 text-orange-700 border-orange-300' },
}

const UNITS = ['pcs', 'nos', 'm', 'm²', 'ft', 'ft²', 'kg', 'gm', 'ltr', 'box', 'set', 'pair', 'roll', 'bundle', 'lot']

// ==================== COMPONENT ====================
export function RequisitionsPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [siteFilter, setSiteFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(15)

  // Dialogs
  const [showForm, setShowForm] = useState(false)
  const [showView, setShowView] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showReasonDialog, setShowReasonDialog] = useState(false)
  const [reasonDialogAction, setReasonDialogAction] = useState<'reject' | 'return' | null>(null)
  const [reason, setReason] = useState('')

  // Form state
  const [editId, setEditId] = useState<string | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formSiteId, setFormSiteId] = useState('')
  const [formRequiredDate, setFormRequiredDate] = useState('')
  const [formPriority, setFormPriority] = useState('MEDIUM')
  const [formNotes, setFormNotes] = useState('')
  const [formBoqItems, setFormBoqItems] = useState<BOQItemForm[]>([emptyBOQItem()])

  // View state
  const [viewData, setViewData] = useState<Requisition | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState('')

  // Data queries
  const { data: requisitionsData, isLoading } = useQuery({
    queryKey: ['requisitions', search, statusFilter, siteFilter, priorityFilter, page, pageSize],
    queryFn: () => api.getRequisitions({
      search, status: statusFilter, siteId: siteFilter, priority: priorityFilter,
      page: String(page), pageSize: String(pageSize), sortBy: 'createdAt', sortOrder: 'desc',
    }),
  })

  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: () => api.getSites(),
  })

  const sites = (sitesData as any)?.data || []

  const requisitions: Requisition[] = (requisitionsData as any)?.data || []
  const pagination = (requisitionsData as any)?.pagination || { page: 1, pageSize, total: 0, totalPages: 0 }

  // Check permissions
  const canViewAll = user?.role === 'ADMIN' || user?.role === 'STOCK_MANAGER'
  const canApproveStock = user?.role === 'ADMIN' || user?.role === 'STOCK_MANAGER'
  const canApproveAdmin = user?.role === 'ADMIN'
  const canManage = user?.role === 'ADMIN'

  // ==================== MUTATIONS ====================
  const createMutation = useMutation({
    mutationFn: (data: any) => api.createRequisition(data),
    onSuccess: () => {
      toast.success('Requisition created successfully')
      queryClient.invalidateQueries({ queryKey: ['requisitions'] })
      closeForm()
    },
    onError: (err: any) => toast.error(err.message || 'Failed to create requisition'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateRequisition(id, data),
    onSuccess: () => {
      toast.success('Requisition updated successfully')
      queryClient.invalidateQueries({ queryKey: ['requisitions'] })
      closeForm()
    },
    onError: (err: any) => toast.error(err.message || 'Failed to update requisition'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteRequisition(id),
    onSuccess: () => {
      toast.success('Requisition deleted')
      queryClient.invalidateQueries({ queryKey: ['requisitions'] })
      setShowDelete(false)
      setDeleteId(null)
    },
    onError: (err: any) => toast.error(err.message || 'Failed to delete'),
  })

  const approveStockMutation = useMutation({
    mutationFn: (id: string) => api.approveStockManagerMir(id),
    onSuccess: () => {
      toast.success('Approved by Stock Manager')
      queryClient.invalidateQueries({ queryKey: ['requisitions'] })
    },
    onError: (err: any) => toast.error(err.message || 'Failed to approve'),
  })

  const approveAdminMutation = useMutation({
    mutationFn: (id: string) => api.approveAdminMir(id),
    onSuccess: () => {
      toast.success('Approved by Admin')
      queryClient.invalidateQueries({ queryKey: ['requisitions'] })
    },
    onError: (err: any) => toast.error(err.message || 'Failed to approve'),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.rejectMir(id, reason),
    onSuccess: () => {
      toast.success('Requisition rejected')
      queryClient.invalidateQueries({ queryKey: ['requisitions'] })
      closeReasonDialog()
    },
    onError: (err: any) => toast.error(err.message || 'Failed to reject'),
  })

  const returnMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.returnMir(id, reason),
    onSuccess: () => {
      toast.success('Requisition returned')
      queryClient.invalidateQueries({ queryKey: ['requisitions'] })
      closeReasonDialog()
    },
    onError: (err: any) => toast.error(err.message || 'Failed to return'),
  })

  const orderMutation = useMutation({
    mutationFn: (id: string) => api.orderMir(id),
    onSuccess: () => {
      toast.success('Requisition marked as ordered')
      queryClient.invalidateQueries({ queryKey: ['requisitions'] })
    },
    onError: (err: any) => toast.error(err.message || 'Failed to order'),
  })

  const receiveMutation = useMutation({
    mutationFn: (id: string) => api.receiveMir(id),
    onSuccess: () => {
      toast.success('Requisition marked as received')
      queryClient.invalidateQueries({ queryKey: ['requisitions'] })
    },
    onError: (err: any) => toast.error(err.message || 'Failed to receive'),
  })

  const bulkActionMutation = useMutation({
    mutationFn: ({ ids, action, reason }: { ids: string[]; action: string; reason?: string }) =>
      api.bulkActionRequisition(ids, action, reason),
    onSuccess: (result: any) => {
      toast.success(`Processed ${result.data.processed} of ${result.data.total} requisitions`)
      queryClient.invalidateQueries({ queryKey: ['requisitions'] })
      setSelectedIds(new Set())
      setBulkAction('')
    },
    onError: (err: any) => toast.error(err.message || 'Bulk action failed'),
  })

  // ==================== HANDLERS ====================
  const resetForm = useCallback(() => {
    setEditId(null)
    setFormTitle('')
    setFormDescription('')
    setFormSiteId('')
    setFormRequiredDate('')
    setFormPriority('MEDIUM')
    setFormNotes('')
    setFormBoqItems([emptyBOQItem()])
  }, [])

  const closeForm = useCallback(() => {
    setShowForm(false)
    resetForm()
  }, [resetForm])

  const openCreateForm = useCallback(() => {
    resetForm()
    setShowForm(true)
  }, [resetForm])

  const openEditForm = useCallback((req: Requisition) => {
    setEditId(req.id)
    setFormTitle(req.title)
    setFormDescription(req.description || '')
    setFormSiteId(req.siteId)
    setFormRequiredDate(req.requiredDate ? req.requiredDate.split('T')[0] : '')
    setFormPriority(req.priority)
    setFormNotes(req.notes || '')
    setFormBoqItems(
      req.boqItems.length > 0
        ? req.boqItems.map(i => ({
            itemName: i.itemName, description: i.description || '',
            quantity: i.quantity, unit: i.unit, unitPrice: i.unitPrice,
            totalPrice: i.totalPrice, category: i.category || '', notes: i.notes || '',
          }))
        : [emptyBOQItem()]
    )
    setShowForm(true)
  }, [])

  const handleSubmit = useCallback(() => {
    if (!formTitle || !formSiteId || !formRequiredDate) {
      toast.error('Title, Site, and Required Date are required')
      return
    }
    const boqItems = formBoqItems.filter(i => i.itemName.trim())
    const data = {
      siteId: formSiteId, title: formTitle, description: formDescription || undefined,
      requiredDate: formRequiredDate, priority: formPriority, notes: formNotes || undefined,
      boqItems: boqItems.length > 0 ? boqItems : undefined,
    }
    if (editId) {
      updateMutation.mutate({ id: editId, data })
    } else {
      createMutation.mutate(data)
    }
  }, [editId, formTitle, formSiteId, formRequiredDate, formDescription, formPriority, formNotes, formBoqItems, createMutation, updateMutation])

  const handleBOQChange = useCallback((index: number, field: keyof BOQItemForm, value: any) => {
    setFormBoqItems(prev => {
      const updated = [...prev]
      const item = { ...updated[index], [field]: value }
      if (field === 'quantity' || field === 'unitPrice') {
        item.totalPrice = (parseFloat(String(item.quantity)) || 0) * (parseFloat(String(item.unitPrice)) || 0)
      }
      if (field === 'totalPrice') {
        // Auto-recalc unit price if quantity > 0
        const qty = parseFloat(String(item.quantity)) || 0
        if (qty > 0) item.unitPrice = parseFloat(String(value)) / qty
        else item.totalPrice = 0
      }
      updated[index] = item
      return updated
    })
  }, [])

  const addBOQItem = useCallback(() => {
    setFormBoqItems(prev => [...prev, emptyBOQItem()])
  }, [])

  const removeBOQItem = useCallback((index: number) => {
    setFormBoqItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev)
  }, [])

  const toggleExpand = useCallback((id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === requisitions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(requisitions.map(r => r.id)))
    }
  }, [selectedIds, requisitions])

  const openReasonDialog = useCallback((id: string, action: 'reject' | 'return') => {
    setActionId(id)
    setReasonDialogAction(action)
    setReason('')
    setShowReasonDialog(true)
  }, [])

  const closeReasonDialog = useCallback(() => {
    setShowReasonDialog(false)
    setActionId(null)
    setReasonDialogAction(null)
    setReason('')
  }, [])

  const submitReason = useCallback(() => {
    if (!reason.trim() || !actionId || !reasonDialogAction) {
      toast.error('Please provide a reason')
      return
    }
    if (reasonDialogAction === 'reject') {
      rejectMutation.mutate({ id: actionId, reason })
    } else {
      returnMutation.mutate({ id: actionId, reason })
    }
  }, [reason, actionId, reasonDialogAction, rejectMutation, returnMutation])

  const handleBulkAction = useCallback(() => {
    if (!bulkAction || selectedIds.size === 0) return
    if (bulkAction === 'reject' || bulkAction === 'return') {
      openReasonDialog(selectedIds.values().next().value!, bulkAction as 'reject' | 'return')
      // For bulk, we need to handle differently — set selected IDs
    } else {
      bulkActionMutation.mutate({ ids: Array.from(selectedIds), action: bulkAction })
    }
  }, [bulkAction, selectedIds, bulkActionMutation, openReasonDialog])

  const totalFormAmount = useMemo(() =>
    formBoqItems.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0),
    [formBoqItems]
  )

  // ==================== RENDER ====================
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-900">Material Requisitions (MIR)</h2>
          <p className="text-sm text-navy-500">Manage material requisitions and BOQ items</p>
        </div>
        <Button onClick={openCreateForm} className="bg-navy-900 hover:bg-navy-800 text-white">
          <Plus className="w-4 h-4 mr-2" /> New Requisition
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-navy-200">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
              <Input
                placeholder="Search by title, description, user..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v === '_all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Statuses</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={siteFilter} onValueChange={v => { setSiteFilter(v === '_all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Site" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Sites</SelectItem>
                {sites.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={v => { setPriorityFilter(v === '_all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Priorities</SelectItem>
                {Object.entries(PRIORITY_CONFIG).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && canViewAll && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-3 flex flex-col sm:flex-row items-center gap-3">
            <span className="text-sm font-medium text-amber-800">
              {selectedIds.size} selected
            </span>
            <div className="flex items-center gap-2">
              <Select value={bulkAction} onValueChange={setBulkAction}>
                <SelectTrigger className="w-[180px] h-8 text-sm">
                  <SelectValue placeholder="Bulk Action..." />
                </SelectTrigger>
                <SelectContent>
                  {canApproveStock && (
                    <SelectItem value="approve_stock_manager">Approve (Stock Mgr)</SelectItem>
                  )}
                  {canApproveAdmin && (
                    <SelectItem value="approve_admin">Approve (Admin)</SelectItem>
                  )}
                  <SelectItem value="reject">Reject</SelectItem>
                  <SelectItem value="return">Return</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkAction}
                disabled={!bulkAction}
                className="border-amber-400 text-amber-800 hover:bg-amber-100"
              >
                Apply
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card className="border-navy-200">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-navy-50 hover:bg-navy-50">
                  {canViewAll && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedIds.size === requisitions.length && requisitions.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                  )}
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden md:table-cell">Site</TableHead>
                  <TableHead className="hidden sm:table-cell">Priority</TableHead>
                  <TableHead className="hidden lg:table-cell">Required Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requisitions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canViewAll ? 9 : 8} className="text-center py-12 text-navy-400">
                      <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      <p>No requisitions found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  requisitions.map(req => {
                    const isExpanded = expandedRows.has(req.id)
                    const priorityCfg = PRIORITY_CONFIG[req.priority] || PRIORITY_CONFIG.MEDIUM
                    const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.PENDING

                    return (
                      <RequisitionRow
                        key={req.id}
                        req={req}
                        isExpanded={isExpanded}
                        isSelected={selectedIds.has(req.id)}
                        currentUserId={user?.id || ''}
                        canViewAll={canViewAll}
                        canApproveStock={canApproveStock}
                        canApproveAdmin={canApproveAdmin}
                        canManage={canManage}
                        priorityCfg={priorityCfg}
                        statusCfg={statusCfg}
                        onToggleExpand={() => toggleExpand(req.id)}
                        onToggleSelect={() => toggleSelect(req.id)}
                        onView={() => { setViewData(req); setShowView(true) }}
                        onEdit={() => openEditForm(req)}
                        onDelete={() => { setDeleteId(req.id); setShowDelete(true) }}
                        onApproveStock={() => approveStockMutation.mutate(req.id)}
                        onApproveAdmin={() => approveAdminMutation.mutate(req.id)}
                        onReject={() => openReasonDialog(req.id, 'reject')}
                        onReturn={() => openReasonDialog(req.id, 'return')}
                        onOrder={() => orderMutation.mutate(req.id)}
                        onReceive={() => receiveMutation.mutate(req.id)}
                      />
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-navy-100">
              <p className="text-sm text-navy-500">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline" size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ==================== CREATE / EDIT DIALOG ==================== */}
      <Dialog open={showForm} onOpenChange={open => { if (!open) closeForm() }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-navy-900">
              {editId ? 'Edit Requisition' : 'New Requisition'}
            </DialogTitle>
            <DialogDescription>
              {editId ? 'Update the requisition details and BOQ items.' : 'Create a new material requisition with BOQ items.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Requisition title"
                />
              </div>
              <div className="space-y-2">
                <Label>Site *</Label>
                <Select value={formSiteId} onValueChange={setFormSiteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}{s.client ? ` (${s.client.name})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Required Date *</Label>
                <Input
                  type="date"
                  value={formRequiredDate}
                  onChange={e => setFormRequiredDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={formPriority} onValueChange={setFormPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_CONFIG).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                placeholder="Brief description of the requisition"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                placeholder="Additional notes"
                rows={2}
              />
            </div>

            <Separator />

            {/* BOQ Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">BOQ Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addBOQItem}>
                  <Plus className="w-4 h-4 mr-1" /> Add Item
                </Button>
              </div>

              <ScrollArea className="max-h-80">
                <div className="space-y-3">
                  {formBoqItems.map((item, index) => (
                    <BOQItemRow
                      key={index}
                      index={index}
                      item={item}
                      canRemove={formBoqItems.length > 1}
                      onChange={(field, value) => handleBOQChange(index, field, value)}
                      onRemove={() => removeBOQItem(index)}
                    />
                  ))}
                </div>
              </ScrollArea>

              <div className="flex justify-end pt-2 border-t">
                <div className="text-right">
                  <p className="text-sm text-navy-500">Total Amount</p>
                  <p className="text-xl font-bold text-navy-900">{formatCurrency(totalFormAmount)}</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-navy-900 hover:bg-navy-800 text-white"
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : editId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== VIEW DIALOG ==================== */}
      <Dialog open={showView} onOpenChange={setShowView}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {viewData && (
            <>
              <DialogHeader>
                <DialogTitle className="text-navy-900">{viewData.title}</DialogTitle>
                <DialogDescription>Requisition Details</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide">Site</p>
                    <p className="font-medium">{viewData.site.name}</p>
                    <p className="text-sm text-navy-500">{viewData.site.client?.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide">Created By</p>
                    <p className="font-medium">{viewData.user.name}</p>
                    <p className="text-sm text-navy-500">{viewData.user.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide">Required Date</p>
                    <p className="font-medium">{formatDate(viewData.requiredDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide">Created</p>
                    <p className="font-medium">{formatDateTime(viewData.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide mb-1">Priority</p>
                    <Badge variant="outline" className={PRIORITY_CONFIG[viewData.priority]?.className}>
                      {PRIORITY_CONFIG[viewData.priority]?.label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide mb-1">Status</p>
                    <Badge variant="outline" className={STATUS_CONFIG[viewData.status]?.className}>
                      {STATUS_CONFIG[viewData.status]?.label}
                    </Badge>
                  </div>
                </div>

                {viewData.description && (
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide mb-1">Description</p>
                    <p className="text-sm">{viewData.description}</p>
                  </div>
                )}

                {viewData.notes && (
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide mb-1">Notes</p>
                    <p className="text-sm">{viewData.notes}</p>
                  </div>
                )}

                {viewData.rejectionReason && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs text-red-500 uppercase tracking-wide mb-1">Rejection Reason</p>
                    <p className="text-sm text-red-700">{viewData.rejectionReason}</p>
                  </div>
                )}

                {viewData.returnReason && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-xs text-orange-500 uppercase tracking-wide mb-1">Return Reason</p>
                    <p className="text-sm text-orange-700">{viewData.returnReason}</p>
                  </div>
                )}

                {/* Approval Info */}
                {(viewData.stockManagerApprovedBy || viewData.adminApprovedBy) && (
                  <div className="space-y-2">
                    <p className="text-xs text-navy-500 uppercase tracking-wide">Approval History</p>
                    <div className="flex flex-wrap gap-3 text-sm">
                      {viewData.stockManagerApprovedBy && (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                          Stock Mgr: {viewData.stockManagerApprovedBy.name}
                          {viewData.stockManagerApprovedAt && (
                            <span className="text-navy-400">({formatDate(viewData.stockManagerApprovedAt)})</span>
                          )}
                        </span>
                      )}
                      {viewData.adminApprovedBy && (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="w-4 h-4" />
                          Admin: {viewData.adminApprovedBy.name}
                          {viewData.adminApprovedAt && (
                            <span className="text-navy-400">({formatDate(viewData.adminApprovedAt)})</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <Separator />

                {/* BOQ Items Table */}
                <div>
                  <p className="text-sm font-semibold text-navy-900 mb-2">
                    BOQ Items ({viewData.boqItems.length})
                  </p>
                  {viewData.boqItems.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-navy-50 hover:bg-navy-50">
                            <TableHead>Item Name</TableHead>
                            <TableHead className="hidden sm:table-cell">Description</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="hidden sm:table-cell">Unit</TableHead>
                            <TableHead className="text-right">Unit Price</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {viewData.boqItems.map(item => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.itemName}</TableCell>
                              <TableCell className="hidden sm:table-cell text-navy-500 text-sm max-w-[200px] truncate">
                                {item.description || '-'}
                              </TableCell>
                              <TableCell className="text-right">{item.quantity}</TableCell>
                              <TableCell className="hidden sm:table-cell">{item.unit}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(item.totalPrice)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-navy-50 font-bold">
                            <TableCell colSpan={5} className="text-right">Grand Total</TableCell>
                            <TableCell className="text-right">{formatCurrency(viewData.totalAmount)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-navy-400 py-4 text-center">No BOQ items</p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ==================== DELETE CONFIRM ==================== */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Requisition</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this requisition? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowDelete(false); setDeleteId(null) }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ==================== REASON DIALOG ==================== */}
      <Dialog open={showReasonDialog} onOpenChange={open => { if (!open) closeReasonDialog() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reasonDialogAction === 'reject' ? 'Reject Requisition' : 'Return Requisition'}
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for {reasonDialogAction === 'reject' ? 'rejecting' : 'returning'} this requisition.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Enter reason..."
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={closeReasonDialog}>Cancel</Button>
            <Button
              onClick={submitReason}
              disabled={rejectMutation.isPending || returnMutation.isPending}
              variant={reasonDialogAction === 'reject' ? 'destructive' : 'default'}
              className={reasonDialogAction === 'return' ? 'bg-orange-600 hover:bg-orange-700 text-white' : ''}
            >
              {rejectMutation.isPending || returnMutation.isPending ? 'Processing...' :
                reasonDialogAction === 'reject' ? 'Reject' : 'Return'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ==================== SUB-COMPONENTS ====================

interface RequisitionRowProps {
  req: Requisition
  isExpanded: boolean
  isSelected: boolean
  currentUserId: string
  canViewAll: boolean
  canApproveStock: boolean
  canApproveAdmin: boolean
  canManage: boolean
  priorityCfg: { label: string; className: string }
  statusCfg: { label: string; className: string }
  onToggleExpand: () => void
  onToggleSelect: () => void
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  onApproveStock: () => void
  onApproveAdmin: () => void
  onReject: () => void
  onReturn: () => void
  onOrder: () => void
  onReceive: () => void
}

function RequisitionRow({
  req, isExpanded, isSelected, currentUserId, canViewAll, canApproveStock, canApproveAdmin,
  canManage, priorityCfg, statusCfg,
  onToggleExpand, onToggleSelect, onView, onEdit, onDelete,
  onApproveStock, onApproveAdmin, onReject, onReturn, onOrder, onReceive,
}: RequisitionRowProps) {
  const showApproveStock = canApproveStock && req.status === 'PENDING'
  const showApproveAdmin = canApproveAdmin && req.status === 'STOCK_MANAGER_APPROVED'
  const showOrder = canManage && req.status === 'ADMIN_APPROVED'
  const showReceive = canViewAll && req.status === 'ORDERED'
  const showReject = canViewAll && ['PENDING', 'STOCK_MANAGER_APPROVED', 'ADMIN_APPROVED'].includes(req.status)
  const showReturn = canViewAll && ['PENDING', 'STOCK_MANAGER_APPROVED', 'ADMIN_APPROVED'].includes(req.status)
  const showEdit = (req.userId === currentUserId || canManage) && ['PENDING', 'RETURNED'].includes(req.status)
  const showDelete = (req.userId === currentUserId || canManage) && ['PENDING', 'RETURNED', 'REJECTED'].includes(req.status)

  return (
    <>
      <TableRow className="group">
        {canViewAll && (
          <TableCell>
            <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
          </TableCell>
        )}
        <TableCell>
          <Button
            variant="ghost" size="icon" className="h-7 w-7"
            onClick={onToggleExpand}
          >
            {isExpanded
              ? <ChevronDown className="w-4 h-4 text-navy-400" />
              : <ChevronRight className="w-4 h-4 text-navy-400" />
            }
          </Button>
        </TableCell>
        <TableCell>
          <div>
            <p className="font-medium text-navy-900">{req.title}</p>
            <p className="text-xs text-navy-400 md:hidden">{req.site.name}</p>
            <p className="text-xs text-navy-400 sm:hidden">{statusCfg.label}</p>
          </div>
        </TableCell>
        <TableCell className="hidden md:table-cell text-sm">{req.site.name}</TableCell>
        <TableCell className="hidden sm:table-cell">
          <Badge variant="outline" className={priorityCfg.className}>{priorityCfg.label}</Badge>
        </TableCell>
        <TableCell className="hidden lg:table-cell text-sm">{formatDate(req.requiredDate)}</TableCell>
        <TableCell className="font-medium">{formatCurrency(req.totalAmount)}</TableCell>
        <TableCell>
          <Badge variant="outline" className={statusCfg.className}>{statusCfg.label}</Badge>
        </TableCell>
        <TableCell className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onView}>
                <Eye className="w-4 h-4 mr-2" /> View
              </DropdownMenuItem>
              {showEdit && (
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="w-4 h-4 mr-2" /> Edit
                </DropdownMenuItem>
              )}
              {showDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </>
              )}
              {(showApproveStock || showApproveAdmin || showReject || showReturn || showOrder || showReceive) && (
                <>
                  <DropdownMenuSeparator />
                  {showApproveStock && (
                    <DropdownMenuItem onClick={onApproveStock} className="text-green-600">
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Approve (Stock Mgr)
                    </DropdownMenuItem>
                  )}
                  {showApproveAdmin && (
                    <DropdownMenuItem onClick={onApproveAdmin} className="text-green-600">
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Approve (Admin)
                    </DropdownMenuItem>
                  )}
                  {showOrder && (
                    <DropdownMenuItem onClick={onOrder}>
                      <ArrowRightToLine className="w-4 h-4 mr-2" /> Mark Ordered
                    </DropdownMenuItem>
                  )}
                  {showReceive && (
                    <DropdownMenuItem onClick={onReceive}>
                      <PackageCheck className="w-4 h-4 mr-2" /> Mark Received
                    </DropdownMenuItem>
                  )}
                  {showReject && (
                    <DropdownMenuItem onClick={onReject} className="text-red-600">
                      <XCircle className="w-4 h-4 mr-2" /> Reject
                    </DropdownMenuItem>
                  )}
                  {showReturn && (
                    <DropdownMenuItem onClick={onReturn} className="text-orange-600">
                      <RotateCcw className="w-4 h-4 mr-2" /> Return
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
      {/* Expanded BOQ Items */}
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={canViewAll ? 9 : 8} className="bg-navy-50/50 px-8 py-2">
            {req.boqItems.length > 0 ? (
              <div className="border rounded-lg overflow-hidden bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-navy-50 hover:bg-navy-50">
                      <TableHead className="text-xs">Item</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell">Category</TableHead>
                      <TableHead className="text-xs text-right">Qty</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell">Unit</TableHead>
                      <TableHead className="text-xs text-right">Unit Price</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {req.boqItems.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm font-medium">{item.itemName}</TableCell>
                        <TableCell className="text-sm text-navy-500 hidden sm:table-cell">{item.category || '-'}</TableCell>
                        <TableCell className="text-sm text-right">{item.quantity}</TableCell>
                        <TableCell className="text-sm hidden sm:table-cell">{item.unit}</TableCell>
                        <TableCell className="text-sm text-right">{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell className="text-sm text-right font-medium">{formatCurrency(item.totalPrice)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-navy-400 py-3">No BOQ items</p>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

function BOQItemRow({
  index, item, canRemove, onChange, onRemove,
}: {
  index: number
  item: BOQItemForm
  canRemove: boolean
  onChange: (field: keyof BOQItemForm, value: any) => void
  onRemove: () => void
}) {
  return (
    <div className="border rounded-lg p-3 bg-slate-50/50 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-navy-500">Item #{index + 1}</span>
        {canRemove && (
          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-700" onClick={onRemove}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input
          placeholder="Item name *"
          value={item.itemName}
          onChange={e => onChange('itemName', e.target.value)}
          className="h-8 text-sm"
        />
        <Input
          placeholder="Category"
          value={item.category}
          onChange={e => onChange('category', e.target.value)}
          className="h-8 text-sm"
        />
        <Input
          placeholder="Description"
          value={item.description}
          onChange={e => onChange('description', e.target.value)}
          className="h-8 text-sm"
        />
        <div className="grid grid-cols-3 gap-2">
          <Input
            type="number"
            placeholder="Qty"
            value={item.quantity || ''}
            onChange={e => onChange('quantity', parseFloat(e.target.value) || 0)}
            className="h-8 text-sm text-right"
            min={0}
            step={0.5}
          />
          <Select value={item.unit} onValueChange={v => onChange('unit', v)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map(u => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="Unit Price"
            value={item.unitPrice || ''}
            onChange={e => onChange('unitPrice', parseFloat(e.target.value) || 0)}
            className="h-8 text-sm text-right"
            min={0}
            step={0.01}
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-navy-400">Total:</span>
        <span className="text-sm font-semibold text-navy-900">{formatCurrency(item.totalPrice)}</span>
      </div>
      <Input
        placeholder="Notes (optional)"
        value={item.notes}
        onChange={e => onChange('notes', e.target.value)}
        className="h-7 text-xs"
      />
    </div>
  )
}
