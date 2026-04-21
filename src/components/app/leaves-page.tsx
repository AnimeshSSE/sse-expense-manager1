'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useLanguage } from '@/hooks/use-language'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  Plus,
  Leaf,
  MoreHorizontal,
  Eye,
  CheckCircle2,
  XCircle,
  X as XIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react'

// ==================== Types ====================

interface LeaveItem {
  id: string
  employeeId: string
  type: string
  startDate: string
  endDate: string
  totalDays: number
  reason: string | null
  status: string
  approvedById: string | null
  approvedAt: string | null
  rejectionReason: string | null
  createdAt: string
  employee: {
    id: string
    employeeCode: string
    user: { id: string; name: string; email: string }
  }
  approvedBy: { id: string; name: string } | null
}

interface EmployeeOption {
  id: string
  employeeCode: string
  user: { id: string; name: string; email: string }
}

interface PaginatedResponse {
  leaves: LeaveItem[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

// ==================== Badges ====================

function LeaveTypeBadge({ type }: { type: string }) {
  const config: Record<string, { className: string }> = {
    CASUAL: { className: 'bg-blue-100 text-blue-800 border-blue-200' },
    SICK: { className: 'bg-red-100 text-red-800 border-red-200' },
    EARNED: { className: 'bg-green-100 text-green-800 border-green-200' },
    HALF_DAY: { className: 'bg-amber-100 text-amber-800 border-amber-200' },
  }
  const c = config[type] || { className: 'bg-gray-100 text-gray-800' }
  return <Badge variant="outline" className={c.className}>{type.replace('_', ' ')}</Badge>
}

function LeaveStatusBadge({ status }: { status: string }) {
  const config: Record<string, { className: string }> = {
    PENDING: { className: 'bg-amber-100 text-amber-800 border-amber-200' },
    APPROVED: { className: 'bg-green-100 text-green-800 border-green-200' },
    REJECTED: { className: 'bg-red-100 text-red-800 border-red-200' },
    CANCELLED: { className: 'bg-gray-100 text-gray-500 border-gray-200' },
  }
  const c = config[status] || { className: 'bg-gray-100 text-gray-800' }
  return <Badge variant="outline" className={c.className}>{status}</Badge>
}

// ==================== Main Component ====================

export function LeavesPage() {
  const { user: currentUser } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const isAdmin = currentUser?.role === 'ADMIN'

  // Filter state
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)

  // Dialog state
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [selectedLeave, setSelectedLeave] = useState<LeaveItem | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    employeeId: '',
    type: 'CASUAL',
    startDate: '',
    endDate: '',
    reason: '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [rejectReason, setRejectReason] = useState('')

  // Fetch leaves
  const { data, isLoading } = useQuery<PaginatedResponse>({
    queryKey: ['leaves', statusFilter, typeFilter, dateFrom, dateTo, page],
    queryFn: () => {
      const params: Record<string, string> = {
        page: String(page),
        pageSize: String(pageSize),
      }
      if (statusFilter !== 'ALL') params.status = statusFilter
      if (typeFilter !== 'ALL') params.type = typeFilter
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      return api.getLeaves(params) as Promise<PaginatedResponse>
    },
  })

  // Fetch employees for admin add dialog
  const { data: employeesData } = useQuery<{ employees: EmployeeOption[] }>({
    queryKey: ['employees-list'],
    queryFn: () => api.getEmployees({ pageSize: '200' }) as Promise<{ employees: EmployeeOption[] }>,
    enabled: isAdmin && showAddDialog,
  })

  const employees = employeesData?.employees || []
  const leaves = data?.leaves || []
  const pagination = data?.pagination
  const totalPages = pagination?.totalPages || 1

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (d: typeof formData) => api.createLeave(d),
    onSuccess: () => {
      toast.success('Leave request submitted')
      queryClient.invalidateQueries({ queryKey: ['leaves'] })
      setShowAddDialog(false)
      resetForm()
    },
    onError: (err: Error) => toast.error(err.message || t.error),
  })

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approveLeave(id),
    onSuccess: () => {
      toast.success('Leave approved')
      queryClient.invalidateQueries({ queryKey: ['leaves'] })
      setShowViewDialog(false)
    },
    onError: (err: Error) => toast.error(err.message || t.error),
  })

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.rejectLeave(id, reason),
    onSuccess: () => {
      toast.success('Leave rejected')
      queryClient.invalidateQueries({ queryKey: ['leaves'] })
      setShowRejectDialog(false)
      setShowViewDialog(false)
      setRejectReason('')
    },
    onError: (err: Error) => toast.error(err.message || t.error),
  })

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.cancelLeave(id),
    onSuccess: () => {
      toast.success('Leave cancelled')
      queryClient.invalidateQueries({ queryKey: ['leaves'] })
      setShowViewDialog(false)
    },
    onError: (err: Error) => toast.error(err.message || t.error),
  })

  function resetForm() {
    setFormData({ employeeId: '', type: 'CASUAL', startDate: '', endDate: '', reason: '' })
    setFormErrors({})
  }

  function validateForm() {
    const errors: Record<string, string> = {}
    if (isAdmin && !formData.employeeId) errors.employeeId = 'Employee is required'
    if (!formData.type) errors.type = 'Type is required'
    if (!formData.startDate) errors.startDate = 'Start date is required'
    if (!formData.endDate) errors.endDate = 'End date is required'
    if (formData.startDate && formData.endDate && new Date(formData.endDate) < new Date(formData.startDate)) {
      errors.endDate = 'End date must be after start date'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  function handleCreate() {
    if (!validateForm()) return
    const payload: Record<string, unknown> = {
      type: formData.type,
      startDate: formData.startDate,
      endDate: formData.endDate,
      reason: formData.reason.trim() || undefined,
    }
    if (isAdmin) payload.employeeId = formData.employeeId
    createMutation.mutate(payload as typeof formData)
  }

  function handleReject() {
    if (!selectedLeave || !rejectReason.trim()) return
    rejectMutation.mutate({ id: selectedLeave.id, reason: rejectReason.trim() })
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <Leaf className="w-7 h-7 text-amber-500" />
            {t.leaves}
          </h2>
          <p className="text-sm text-navy-500 mt-1">
            {isAdmin ? 'Manage and approve employee leave requests' : 'View and request your leaves'}
          </p>
        </div>
        <Button
          className="bg-amber-500 hover:bg-amber-600 text-white"
          onClick={() => { resetForm(); setShowAddDialog(true) }}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Request Leave
        </Button>
      </div>

      {/* Filters */}
      <Card className="rounded-xl border-navy-100 bg-white p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-3 flex-1 flex-wrap">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[150px] border-navy-200">
                <Filter className="w-4 h-4 mr-1.5 text-navy-400" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="PENDING">{t.pending}</SelectItem>
                <SelectItem value="APPROVED">{t.approved}</SelectItem>
                <SelectItem value="REJECTED">{t.rejected}</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[150px] border-navy-200">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="CASUAL">Casual</SelectItem>
                <SelectItem value="SICK">Sick</SelectItem>
                <SelectItem value="EARNED">Earned</SelectItem>
                <SelectItem value="HALF_DAY">Half Day</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <div className="relative">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                  className="border-navy-200 focus:border-amber-400 focus:ring-amber-400/20 w-[150px] text-sm"
                  placeholder="From"
                />
              </div>
              <div className="relative">
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                  className="border-navy-200 focus:border-amber-400 focus:ring-amber-400/20 w-[150px] text-sm"
                  placeholder="To"
                />
              </div>
            </div>
          </div>
          {(statusFilter !== 'ALL' || typeFilter !== 'ALL' || dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-navy-500 hover:text-navy-700 shrink-0"
              onClick={() => { setStatusFilter('ALL'); setTypeFilter('ALL'); setDateFrom(''); setDateTo(''); setPage(1) }}
            >
              <XIcon className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card className="rounded-xl border-navy-100 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-navy-100 bg-navy-50/50">
                <TableHead className="text-navy-700 font-semibold">{t.employee}</TableHead>
                <TableHead className="text-navy-700 font-semibold">Type</TableHead>
                <TableHead className="text-navy-700 font-semibold">Start Date</TableHead>
                <TableHead className="text-navy-700 font-semibold">End Date</TableHead>
                <TableHead className="text-navy-700 font-semibold">Days</TableHead>
                <TableHead className="text-navy-700 font-semibold">{t.reason}</TableHead>
                <TableHead className="text-navy-700 font-semibold">{t.status}</TableHead>
                <TableHead className="text-navy-700 font-semibold text-right">{t.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-navy-50">
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : leaves.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-navy-400">
                    {t.noData}
                  </TableCell>
                </TableRow>
              ) : (
                leaves.map((leave) => (
                  <TableRow
                    key={leave.id}
                    className="border-navy-50 hover:bg-amber-50/30 transition-colors"
                  >
                    <TableCell className="text-sm font-medium text-navy-900">
                      <div>
                        <span>{leave.employee.user.name}</span>
                        {isAdmin && (
                          <p className="text-[10px] text-navy-400">{leave.employee.employeeCode}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell><LeaveTypeBadge type={leave.type} /></TableCell>
                    <TableCell className="text-sm text-navy-600">
                      {formatDate(leave.startDate)}
                    </TableCell>
                    <TableCell className="text-sm text-navy-600">
                      {formatDate(leave.endDate)}
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-navy-900">
                      {leave.totalDays}
                    </TableCell>
                    <TableCell className="text-sm text-navy-600 max-w-[180px] truncate">
                      {leave.reason || '—'}
                    </TableCell>
                    <TableCell>
                      <LeaveStatusBadge status={leave.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => { setSelectedLeave(leave); setShowViewDialog(true) }}>
                            <Eye className="w-4 h-4 mr-2" /> View Details
                          </DropdownMenuItem>
                          {/* Admin actions */}
                          {isAdmin && leave.status === 'PENDING' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => approveMutation.mutate(leave.id)} className="text-green-600 focus:text-green-600">
                                <CheckCircle2 className="w-4 h-4 mr-2" /> {t.approve}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSelectedLeave(leave); setRejectReason(''); setShowRejectDialog(true) }} className="text-red-600 focus:text-red-600">
                                <XCircle className="w-4 h-4 mr-2" /> {t.reject}
                              </DropdownMenuItem>
                            </>
                          )}
                          {/* Owner cancel */}
                          {!isAdmin && leave.status === 'PENDING' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => cancelMutation.mutate(leave.id)} className="text-orange-600 focus:text-orange-600">
                                <XIcon className="w-4 h-4 mr-2" /> Cancel
                              </DropdownMenuItem>
                            </>
                          )}
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
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-navy-100">
            <p className="text-sm text-navy-500">
              Showing {(pagination.page - 1) * pagination.pageSize + 1}–
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
              {pagination.total}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
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
                    variant={pageNum === page ? 'default' : 'outline'}
                    size="icon"
                    className={`h-8 w-8 ${pageNum === page ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}`}
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                )
              })}
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Add Leave Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) resetForm() }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-navy-900">Request Leave</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Employee selector (admin only) */}
            {isAdmin && (
              <div className="grid gap-2">
                <Label className="text-navy-700">{t.employee} *</Label>
                <Select value={formData.employeeId} onValueChange={(v) => setFormData((f) => ({ ...f, employeeId: v }))}>
                  <SelectTrigger className="border-navy-200">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.user.name} ({emp.employeeCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.employeeId && <p className="text-xs text-red-500">{formErrors.employeeId}</p>}
              </div>
            )}

            <div className="grid gap-2">
              <Label className="text-navy-700">Leave Type *</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData((f) => ({ ...f, type: v }))}>
                <SelectTrigger className="border-navy-200">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASUAL">Casual Leave</SelectItem>
                  <SelectItem value="SICK">Sick Leave</SelectItem>
                  <SelectItem value="EARNED">Earned Leave</SelectItem>
                  <SelectItem value="HALF_DAY">Half Day</SelectItem>
                </SelectContent>
              </Select>
              {formErrors.type && <p className="text-xs text-red-500">{formErrors.type}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-navy-700">Start Date *</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData((f) => ({ ...f, startDate: e.target.value }))}
                  className="border-navy-200 focus:border-amber-400 focus:ring-amber-400/20"
                />
                {formErrors.startDate && <p className="text-xs text-red-500">{formErrors.startDate}</p>}
              </div>
              <div className="grid gap-2">
                <Label className="text-navy-700">End Date *</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData((f) => ({ ...f, endDate: e.target.value }))}
                  className="border-navy-200 focus:border-amber-400 focus:ring-amber-400/20"
                />
                {formErrors.endDate && <p className="text-xs text-red-500">{formErrors.endDate}</p>}
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-navy-700">{t.reason}</Label>
              <Textarea
                placeholder="Reason for leave (optional)"
                value={formData.reason}
                onChange={(e) => setFormData((f) => ({ ...f, reason: e.target.value }))}
                rows={3}
                className="border-navy-200 focus:border-amber-400 focus:ring-amber-400/20 resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm() }} className="border-navy-200">
              {t.cancel}
            </Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-[550px]">
          {selectedLeave && (
            <>
              <DialogHeader>
                <DialogTitle className="text-navy-900 flex items-center gap-2">
                  Leave Details
                  <LeaveTypeBadge type={selectedLeave.type} />
                  <LeaveStatusBadge status={selectedLeave.status} />
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {/* Employee info */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-navy-900 text-white flex items-center justify-center text-sm font-bold shrink-0">
                    {selectedLeave.employee.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-navy-900">{selectedLeave.employee.user.name}</p>
                    <p className="text-xs text-navy-400">{selectedLeave.employee.employeeCode} · {selectedLeave.employee.user.email}</p>
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide">Type</p>
                    <LeaveTypeBadge type={selectedLeave.type} />
                  </div>
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide">Days</p>
                    <p className="text-lg font-bold text-navy-900">{selectedLeave.totalDays}</p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide">Start Date</p>
                    <p className="text-sm text-navy-800">{formatDate(selectedLeave.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide">End Date</p>
                    <p className="text-sm text-navy-800">{formatDate(selectedLeave.endDate)}</p>
                  </div>
                </div>

                {/* Reason */}
                {selectedLeave.reason && (
                  <div className="bg-navy-50 rounded-lg p-3">
                    <p className="text-xs text-navy-500 uppercase tracking-wide mb-1">{t.reason}</p>
                    <p className="text-sm text-navy-700">{selectedLeave.reason}</p>
                  </div>
                )}

                {/* Rejection reason */}
                {selectedLeave.rejectionReason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-xs text-red-600 uppercase tracking-wide mb-1">Rejection Reason</p>
                    <p className="text-sm text-red-800">{selectedLeave.rejectionReason}</p>
                  </div>
                )}

                {/* Approval details */}
                {(selectedLeave.approvedById || selectedLeave.approvedAt) && (
                  <div className="border-t border-navy-100 pt-4">
                    <p className="text-xs text-navy-500 uppercase tracking-wide font-semibold mb-2">Approval Details</p>
                    <div className="space-y-2 text-sm">
                      {selectedLeave.approvedBy && (
                        <div className="flex items-center gap-2 text-navy-600">
                          <div className="w-2 h-2 rounded-full bg-green-400" />
                          <span>
                            {selectedLeave.status === 'APPROVED' ? 'Approved' : 'Reviewed'} by <strong>{selectedLeave.approvedBy.name}</strong>
                          </span>
                        </div>
                      )}
                      {selectedLeave.approvedAt && (
                        <div className="flex items-center gap-2 text-navy-500">
                          <div className="w-2 h-2 rounded-full bg-navy-300" />
                          <span>{formatDateTime(selectedLeave.approvedAt)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Timeline */}
                <div className="border-t border-navy-100 pt-4">
                  <p className="text-xs text-navy-500 uppercase tracking-wide font-semibold mb-2">Timeline</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-navy-600">
                      <div className="w-2 h-2 rounded-full bg-navy-300" />
                      Requested: {formatDateTime(selectedLeave.createdAt)}
                    </div>
                    {selectedLeave.status === 'APPROVED' && selectedLeave.approvedAt && (
                      <div className="flex items-center gap-2 text-green-600">
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                        Approved: {formatDateTime(selectedLeave.approvedAt)}
                      </div>
                    )}
                    {selectedLeave.status === 'REJECTED' && selectedLeave.approvedAt && (
                      <div className="flex items-center gap-2 text-red-600">
                        <div className="w-2 h-2 rounded-full bg-red-400" />
                        Rejected: {formatDateTime(selectedLeave.approvedAt)}
                      </div>
                    )}
                    {selectedLeave.status === 'CANCELLED' && (
                      <div className="flex items-center gap-2 text-gray-500">
                        <div className="w-2 h-2 rounded-full bg-gray-400" />
                        Cancelled
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Admin action buttons */}
              {isAdmin && selectedLeave.status === 'PENDING' && (
                <DialogFooter className="gap-2 sm:gap-0 border-t border-navy-100 pt-4">
                  <Button
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => { setShowViewDialog(false); setRejectReason(''); setShowRejectDialog(true) }}
                  >
                    <XCircle className="w-4 h-4 mr-1.5" />
                    {t.reject}
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => approveMutation.mutate(selectedLeave.id)}
                    disabled={approveMutation.isPending}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    {approveMutation.isPending ? 'Approving...' : t.approve}
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Reason Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-navy-900 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              Reject Leave
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label className="text-navy-700">{t.reason} *</Label>
              <Textarea
                placeholder="Enter rejection reason..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className="border-navy-200 focus:border-amber-400 focus:ring-amber-400/20 resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setShowRejectDialog(false); setRejectReason('') }} className="border-navy-200">
              {t.cancel}
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleReject}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? 'Rejecting...' : t.reject}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
