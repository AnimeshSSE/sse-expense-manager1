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
  Ban,
  RotateCcw,
  Banknote,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Printer,
  Users as UsersIcon,
  FileSpreadsheet,
} from 'lucide-react'
import { CommentThread } from '@/components/comment-thread'
import { BulkUploadDialog } from '@/components/bulk-upload-dialog'

const ADVANCE_STATUSES = ['PENDING', 'PAID', 'REJECTED', 'RETURNED']
// Note: APPROVED status is removed — accountant approval directly pays the advance

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-cyan-100 text-cyan-800',
  PAID: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  RETURNED: 'bg-orange-100 text-orange-800',
}

const TOTAL_COLUMNS = 8 // S.No + Date + Site + Purpose + Amount + Status + Submitted By + Actions

export function AdvancesPage() {
  const { user, permissions } = useAuth()
  const [advances, setAdvances] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [siteFilter, setSiteFilter] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Reference data
  const [clients, setClients] = useState<any[]>([])
  const [sites, setSites] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [viewAdvance, setViewAdvance] = useState<any>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editAdvance, setEditAdvance] = useState<any>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<any>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnTarget, setReturnTarget] = useState<any>(null)
  const [returnReason, setReturnReason] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false)

  // Create form
  const [form, setForm] = useState({
    clientId: '',
    siteId: '',
    amount: '',
    purpose: '',
    notes: '',
  })

  // Edit form
  const [editForm, setEditForm] = useState({
    amount: '',
    purpose: '',
    notes: '',
  })

  // Filter sites by selected client in form
  const formFilteredSites = form.clientId
    ? sites.filter((s: any) => s.clientId === form.clientId)
    : sites

  // Filter sites by selected client in filters
  const filterFilteredSites = clientFilter
    ? sites.filter((s: any) => s.clientId === clientFilter)
    : sites

  const loadReferenceData = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([
        api.getClients(),
        api.getSites(),
      ])
      setClients(c || [])
      setSites(s || [])
      // Load users for admin/accountant
      if (user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT') {
        const u = await api.getUsers()
        setAllUsers(u || [])
      }
    } catch { /* handled */ }
  }, [user?.role])

  const loadAdvances = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {
        page: page.toString(),
        limit: limit.toString(),
        sort: sortField,
        sortDir,
      }
      if (statusFilter) params.status = statusFilter
      if (siteFilter) params.siteId = siteFilter
      if (clientFilter) params.clientId = clientFilter
      if (employeeFilter) params.userId = employeeFilter
      if (monthFilter) params.month = monthFilter
      if (search) params.search = search

      const result = await api.getAdvances(params)
      setAdvances(result.data || [])
      setTotal(result.total || 0)
    } catch { /* handled */ }
    finally {
      setLoading(false)
    }
  }, [page, limit, statusFilter, siteFilter, clientFilter, employeeFilter, monthFilter, search, sortField, sortDir])

  useEffect(() => {
    loadReferenceData()
  }, [loadReferenceData])

  useEffect(() => {
    loadAdvances()
  }, [loadAdvances])

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
    setStatusFilter('')
    setSiteFilter('')
    setClientFilter('')
    setEmployeeFilter('')
    setMonthFilter('')
    setSearch('')
    setPage(1)
  }

  const hasActiveFilters = statusFilter || siteFilter || clientFilter || employeeFilter || monthFilter || search

  // Create handler
  const handleCreate = async () => {
    if (!form.siteId || !form.amount || !form.purpose) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' })
      return
    }
    setActionLoading(true)
    try {
      await api.createAdvance({
        siteId: form.siteId,
        amount: parseFloat(form.amount),
        purpose: form.purpose,
        notes: form.notes || undefined,
      })
      toast({ title: 'Success', description: 'Advance created successfully' })
      setCreateOpen(false)
      setForm({ clientId: '', siteId: '', amount: '', purpose: '', notes: '' })
      loadAdvances()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  // Edit handlers
  const handleOpenEdit = (advance: any) => {
    setEditAdvance({ ...advance })
    setEditForm({
      amount: advance.amount?.toString() || '',
      purpose: advance.purpose || '',
      notes: advance.notes || '',
    })
    setEditOpen(true)
  }

  const handleEdit = async () => {
    if (!editAdvance) return
    if (!editForm.purpose || !editForm.amount) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' })
      return
    }
    setActionLoading(true)
    try {
      await api.updateAdvance(editAdvance.id, {
        amount: parseFloat(editForm.amount),
        purpose: editForm.purpose,
        notes: editForm.notes,
      })
      toast({ title: 'Success', description: 'Advance updated successfully' })
      setEditOpen(false)
      setEditAdvance(null)
      loadAdvances()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast({ title: 'Error', description: 'Please provide a reason', variant: 'destructive' })
      return
    }
    setActionLoading(true)
    try {
      await api.rejectAdvance(rejectTarget.id, rejectReason)
      toast({ title: 'Success', description: 'Advance rejected' })
      setRejectOpen(false)
      setRejectReason('')
      loadAdvances()
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
      await api.returnAdvance(returnTarget.id, returnReason)
      toast({ title: 'Success', description: 'Advance returned' })
      setReturnOpen(false)
      setReturnReason('')
      loadAdvances()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const handleDelete = async () => {
    setActionLoading(true)
    try {
      await api.deleteAdvance(deleteTarget.id)
      toast({ title: 'Success', description: 'Advance deleted' })
      setDeleteOpen(false)
      loadAdvances()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  // Accountant approve (auto-pays)
  const handleApproveAccountant = async (id: string) => {
    setActionLoading(true)
    try {
      await api.approveAdvanceAccountant(id)
      toast({ title: 'Success', description: 'Advance approved and paid' })
      loadAdvances()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const isAdmin = user?.role === 'ADMIN'
  const isAccountant = user?.role === 'ACCOUNTANT'
  const canManage = isAdmin || isAccountant

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Advances</h2>
          <p className="text-sm text-stone-500">Manage advance requests &bull; Accountant approval directly pays</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={() => setBulkUploadOpen(true)}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Bulk Upload
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="bg-stone-900 hover:bg-stone-800 w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-2" />
            New Advance
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
                placeholder="Search advances..."
                className="h-8 pl-9 text-xs"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              />
            </div>

            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
                {ADVANCE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">{s.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {canManage && (
              <Select value={clientFilter} onValueChange={(v) => { setClientFilter(v === 'all' ? '' : v); setSiteFilter(''); setPage(1) }}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue placeholder="Client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Clients</SelectItem>
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={siteFilter} onValueChange={(v) => { setSiteFilter(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="Site" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Sites</SelectItem>
                {(clientFilter ? filterFilteredSites : sites).map((s: any) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {canManage && (
              <Select value={employeeFilter} onValueChange={(v) => { setEmployeeFilter(v === 'all' ? '' : v); setPage(1) }}>
                <SelectTrigger className="h-8 w-40 text-xs">
                  <UsersIcon className="w-3 h-3 mr-1 text-stone-400" />
                  <SelectValue placeholder="Employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Employees</SelectItem>
                  {allUsers.map((u: any) => (
                    <SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={monthFilter} onValueChange={(v) => { setMonthFilter(v === 'all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Months</SelectItem>
                {Array.from({ length: 12 }, (_, i) => {
                  const date = new Date()
                  date.setMonth(date.getMonth() - i)
                  const val = date.toISOString().slice(0, 7)
                  return (
                    <SelectItem key={val} value={val} className="text-xs">
                      {date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>

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
                  <TableHead className="text-xs w-12 text-center">S.No.</TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('createdAt')}>
                    <div className="flex items-center gap-1">Date <SortIcon field="createdAt" /></div>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('site.name')}>
                    <div className="flex items-center gap-1">Site <SortIcon field="site.name" /></div>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('purpose')}>
                    <div className="flex items-center gap-1">Purpose <SortIcon field="purpose" /></div>
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
                ) : advances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={TOTAL_COLUMNS} className="text-center py-12 text-stone-400 text-sm">
                      <Banknote className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No advances found
                    </TableCell>
                  </TableRow>
                ) : (
                  advances.map((a: any, index: number) => {
                    const isOwn = a.userId === user?.id
                    const sno = (page - 1) * limit + index + 1
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs text-center text-stone-500">{sno}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="text-xs">{a.site?.name || '-'}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{a.purpose}</TableCell>
                        <TableCell className="text-xs font-medium whitespace-nowrap">
                          <Banknote className="w-3 h-3 inline mr-0.5 -mt-px" />
                          {a.amount?.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${statusColors[a.status] || ''}`}>
                            {a.status?.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{a.user?.name || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* View */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => { setViewAdvance(a); setViewOpen(true) }}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>

                            {/* Edit - Admin: any non-PAID, non-REJECTED */}
                            {isAdmin && a.status !== 'PAID' && a.status !== 'REJECTED' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-stone-500 hover:text-amber-600"
                                onClick={() => handleOpenEdit(a)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            )}

                            {/* Edit - Own RETURNED */}
                            {isOwn && a.status === 'RETURNED' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-stone-500 hover:text-amber-600"
                                onClick={() => handleOpenEdit(a)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            )}

                            {/* Approve + Auto-pay - Accountant or Admin on PENDING */}
                            {(isAccountant || isAdmin) && a.status === 'PENDING' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-stone-500 hover:text-green-600"
                                onClick={() => handleApproveAccountant(a.id)}
                                disabled={actionLoading}
                                title="Approve & Pay (Direct)"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </Button>
                            )}

                            {/* Reject / Return */}
                            {(isAccountant || isAdmin) && (a.status === 'PENDING') && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-stone-500 hover:text-red-600"
                                  onClick={() => { setRejectTarget(a); setRejectOpen(true) }}
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-stone-500 hover:text-orange-600"
                                  onClick={() => { setReturnTarget(a); setReturnOpen(true) }}
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}

                            {/* Delete - Own PENDING */}
                            {isOwn && a.status === 'PENDING' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-stone-500 hover:text-red-600"
                                onClick={() => { setDeleteTarget(a); setDeleteOpen(true) }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}

                            {/* Admin Delete */}
                            {isAdmin && a.status === 'PENDING' && !isOwn && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-stone-500 hover:text-red-600"
                                onClick={() => { setDeleteTarget(a); setDeleteOpen(true) }}
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
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .map((p, i, arr) => (
                    <span key={p} className="flex items-center">
                      {i > 0 && arr[i - 1] !== p - 1 && <span className="text-xs text-stone-400 px-1">...</span>}
                      <Button
                        variant={p === page ? 'default' : 'outline'}
                        size="icon"
                        className="h-7 w-7 text-xs"
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </Button>
                    </span>
                  ))}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Advance Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Advance</DialogTitle>
            <DialogDescription>Request an advance payment for site work</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Client</Label>
                <Select
                  value={form.clientId}
                  onValueChange={(v) => setForm({ ...form, clientId: v, siteId: '' })}
                >
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
                <Label className="text-xs">Site <span className="text-red-500">*</span></Label>
                <Select
                  value={form.siteId}
                  onValueChange={(v) => setForm({ ...form, siteId: v })}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    {formFilteredSites.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Amount (₹) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                placeholder="Enter amount"
                className="h-9 text-sm"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Purpose <span className="text-red-500">*</span></Label>
              <Textarea
                placeholder="Describe the purpose of this advance"
                className="min-h-[80px] text-sm"
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Notes</Label>
              <Textarea
                placeholder="Additional notes (optional)"
                className="min-h-[60px] text-sm"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={actionLoading} className="bg-stone-900 hover:bg-stone-800">
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Advance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Advance Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>Advance Details</DialogTitle>
            <Button variant="outline" size="sm" className="print:hidden" onClick={() => window.print()}>
              <Printer className="w-3.5 h-3.5 mr-1" />
              Print
            </Button>
          </DialogHeader>
          {viewAdvance && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-stone-500 text-xs">Purpose</span>
                  <p className="font-medium">{viewAdvance.purpose}</p>
                </div>
                <div>
                  <span className="text-stone-500 text-xs">Amount</span>
                  <p className="font-medium">
                    <Banknote className="w-3.5 h-3.5 inline mr-0.5 -mt-0.5" />
                    {viewAdvance.amount?.toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-stone-500 text-xs">Status</span>
                  <Badge className={`text-[10px] mt-1 ${statusColors[viewAdvance.status] || ''}`}>
                    {viewAdvance.status?.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <div>
                  <span className="text-stone-500 text-xs">Date</span>
                  <p className="font-medium">{viewAdvance.createdAt ? new Date(viewAdvance.createdAt).toLocaleDateString() : '-'}</p>
                </div>
                <div>
                  <span className="text-stone-500 text-xs">Site</span>
                  <p className="font-medium">{viewAdvance.site?.name || '-'}</p>
                </div>
                <div>
                  <span className="text-stone-500 text-xs">Client</span>
                  <p className="font-medium">{viewAdvance.site?.client?.name || '-'}</p>
                </div>
                <div>
                  <span className="text-stone-500 text-xs">Submitted By</span>
                  <p className="font-medium">{viewAdvance.user?.name || '-'}</p>
                </div>
              </div>

              {viewAdvance.notes && (
                <div className="text-sm">
                  <span className="text-stone-500 text-xs">Notes</span>
                  <p className="font-medium mt-1">{viewAdvance.notes}</p>
                </div>
              )}

              {/* Approval History */}
              {(viewAdvance.accountantApprovedBy || viewAdvance.paidBy) && (
                <div className="text-sm">
                  <span className="text-stone-500 text-xs">Approval History</span>
                  <div className="mt-1 space-y-1">
                    {viewAdvance.accountantApprovedBy && (
                      <p className="text-xs">
                        <span className="text-cyan-700 font-medium">Accountant Approved</span>{' '}
                        by {viewAdvance.accountantApprovedBy.name}
                        {viewAdvance.accountantApprovedAt && ` on ${new Date(viewAdvance.accountantApprovedAt).toLocaleDateString()}`}
                      </p>
                    )}
                    {viewAdvance.paidBy && (
                      <p className="text-xs">
                        <span className="text-green-700 font-medium">Paid</span>{' '}
                        by {viewAdvance.paidBy.name}
                        {viewAdvance.paidAt && ` on ${new Date(viewAdvance.paidAt).toLocaleDateString()}`}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {(viewAdvance.rejectionReason || viewAdvance.returnReason) && (
                <div className="bg-red-50 p-3 rounded-lg text-sm">
                  {viewAdvance.rejectionReason && (
                    <p><span className="font-medium text-red-800">Rejection Reason: </span>{viewAdvance.rejectionReason}</p>
                  )}
                  {viewAdvance.returnReason && (
                    <p><span className="font-medium text-orange-800">Return Reason: </span>{viewAdvance.returnReason}</p>
                  )}
                </div>
              )}

              {/* Comments Thread */}
              <CommentThread entityType="ADVANCE" entityId={viewAdvance.id} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Advance Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Advance</DialogTitle>
            <DialogDescription>Update advance details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Amount (₹) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                className="h-9 text-sm"
                value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Purpose <span className="text-red-500">*</span></Label>
              <Textarea
                className="min-h-[80px] text-sm"
                value={editForm.purpose}
                onChange={(e) => setEditForm({ ...editForm, purpose: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Notes</Label>
              <Textarea
                className="min-h-[60px] text-sm"
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={actionLoading} className="bg-stone-900 hover:bg-stone-800">
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Advance</DialogTitle>
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
            <DialogTitle>Return Advance</DialogTitle>
            <DialogDescription>Please provide a reason for returning this advance</DialogDescription>
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
            <AlertDialogTitle>Delete Advance</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this advance? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={actionLoading} className="bg-red-600 hover:bg-red-700">
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Upload Dialog */}
      <BulkUploadDialog
        open={bulkUploadOpen}
        onOpenChange={setBulkUploadOpen}
        type="advances"
        onSuccess={loadAdvances}
      />
    </div>
  )
}
