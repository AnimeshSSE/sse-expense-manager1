'use client'

import { useState, useRef, useMemo } from 'react'
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
  Search,
  MoreHorizontal,
  Eye,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Banknote,
  Pencil,
  Trash2,
  Upload,
  Download,
  ChevronLeft,
  ChevronRight,
  BanknoteIcon,
  Filter,
} from 'lucide-react'

// ==================== Types ====================

interface Advance {
  id: string
  userId: string
  siteId: string
  amount: number
  purpose: string
  status: string
  notes: string | null
  accountantApprovedById: string | null
  accountantApprovedAt: string | null
  adminApprovedById: string | null
  adminApprovedAt: string | null
  paidById: string | null
  paidAt: string | null
  rejectionReason: string | null
  returnReason: string | null
  createdAt: string
  updatedAt: string
  site: { id: string; name: string; client: { id: string; name: string } | null }
  user: { id: string; name: string; email: string }
  accountantApprovedBy: { id: string; name: string } | null
  adminApprovedBy: { id: string; name: string } | null
  paidBy: { id: string; name: string } | null
}

interface Site {
  id: string
  name: string
  client: { id: string; name: string } | null
}

interface PaginatedResponse {
  advances: Advance[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

// ==================== Status Badge ====================

function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage()
  const config: Record<string, { label: string; className: string }> = {
    PENDING: {
      label: t.pending,
      className: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    APPROVED: {
      label: t.approved,
      className: 'bg-blue-100 text-blue-800 border-blue-200',
    },
    PAID: {
      label: t.paid,
      className: 'bg-green-100 text-green-800 border-green-200',
    },
    REJECTED: {
      label: t.rejected,
      className: 'bg-red-100 text-red-800 border-red-200',
    },
    RETURNED: {
      label: t.returned,
      className: 'bg-orange-100 text-orange-800 border-orange-200',
    },
  }

  const c = config[status] || { label: status, className: 'bg-gray-100 text-gray-800' }

  return (
    <Badge variant="outline" className={c.className}>
      {c.label}
    </Badge>
  )
}

// ==================== Main Component ====================

export function AdvancesPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Filter state
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [siteFilter, setSiteFilter] = useState<string>('ALL')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)

  // Dialog state
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showReasonDialog, setShowReasonDialog] = useState(false)
  const [selectedAdvance, setSelectedAdvance] = useState<Advance | null>(null)
  const [reasonAction, setReasonAction] = useState<string>('')

  // Form state
  const [formData, setFormData] = useState({
    siteId: '',
    amount: '',
    purpose: '',
    notes: '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')

  // Permission helpers
  const isAdmin = user?.role === 'ADMIN'
  const isAccountant = user?.role === 'ACCOUNTANT'
  const canApprove = isAdmin || isAccountant
  const canMarkPaid = isAdmin || isAccountant

  // Fetch advances
  const { data, isLoading } = useQuery<PaginatedResponse>({
    queryKey: ['advances', search, statusFilter, siteFilter, page],
    queryFn: () => {
      const params: Record<string, string> = {
        page: String(page),
        pageSize: String(pageSize),
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }
      if (search) params.search = search
      if (statusFilter !== 'ALL') params.status = statusFilter
      if (siteFilter !== 'ALL') params.siteId = siteFilter
      return api.getAdvances(params) as Promise<PaginatedResponse>
    },
  })

  // Fetch sites for dropdowns
  const { data: sitesData } = useQuery<{ sites: Site[] }>({
    queryKey: ['sites'],
    queryFn: () => api.getSites() as Promise<{ sites: Site[] }>,
  })

  const sites = useMemo(() => sitesData?.sites || [], [sitesData])

  // Fetch comments for view dialog
  const { data: commentsData } = useQuery<any>({
    queryKey: ['comments', 'Advance', selectedAdvance?.id],
    queryFn: () => api.getComments('Advance', selectedAdvance!.id),
    enabled: !!selectedAdvance && showViewDialog,
  })

  const comments = (commentsData?.comments || []) as any[]

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: { siteId: string; amount: number; purpose: string; notes?: string }) =>
      api.createAdvance(data),
    onSuccess: () => {
      toast.success(t.success)
      queryClient.invalidateQueries({ queryKey: ['advances'] })
      setShowAddDialog(false)
      resetForm()
    },
    onError: (err: Error) => {
      toast.error(err.message || t.error)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAdvance(id),
    onSuccess: () => {
      toast.success(t.success)
      queryClient.invalidateQueries({ queryKey: ['advances'] })
      setShowDeleteDialog(false)
      setSelectedAdvance(null)
    },
    onError: (err: Error) => {
      toast.error(err.message || t.error)
    },
  })

  // Action mutations
  const approveAccountantMutation = useMutation({
    mutationFn: (id: string) => api.approveAccountantAdvance(id),
    onSuccess: () => {
      toast.success('Advance approved & paid successfully')
      queryClient.invalidateQueries({ queryKey: ['advances'] })
    },
    onError: (err: Error) => toast.error(err.message || t.error),
  })

  const approveAdminMutation = useMutation({
    mutationFn: (id: string) => api.approveAdminAdvance(id),
    onSuccess: () => {
      toast.success('Advance approved successfully')
      queryClient.invalidateQueries({ queryKey: ['advances'] })
    },
    onError: (err: Error) => toast.error(err.message || t.error),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.rejectAdvance(id, reason),
    onSuccess: () => {
      toast.success('Advance rejected')
      queryClient.invalidateQueries({ queryKey: ['advances'] })
      setShowReasonDialog(false)
      setReason('')
    },
    onError: (err: Error) => toast.error(err.message || t.error),
  })

  const returnMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.returnAdvance(id, reason),
    onSuccess: () => {
      toast.success('Advance returned')
      queryClient.invalidateQueries({ queryKey: ['advances'] })
      setShowReasonDialog(false)
      setReason('')
    },
    onError: (err: Error) => toast.error(err.message || t.error),
  })

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => api.markPaidAdvance(id),
    onSuccess: () => {
      toast.success('Advance marked as paid')
      queryClient.invalidateQueries({ queryKey: ['advances'] })
    },
    onError: (err: Error) => toast.error(err.message || t.error),
  })

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: (content: string) =>
      api.addComment({ entityType: 'Advance', entityId: selectedAdvance!.id, content }),
    onSuccess: () => {
      toast.success('Comment added')
      queryClient.invalidateQueries({ queryKey: ['comments'] })
    },
    onError: () => toast.error('Failed to add comment'),
  })

  // Bulk upload
  const bulkUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return api.bulkUpload(formData)
    },
    onSuccess: (result: any) => {
      toast.success(`Imported ${result.created} of ${result.total} advances`)
      queryClient.invalidateQueries({ queryKey: ['advances'] })
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    onError: (err: Error) => toast.error(err.message || 'Upload failed'),
  })

  // Download template
  const handleDownloadTemplate = async () => {
    try {
      const blob = await api.getAdvanceBulkUploadTemplate()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'advances-template.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Failed to download template')
    }
  }

  // Form helpers
  function resetForm() {
    setFormData({ siteId: '', amount: '', purpose: '', notes: '' })
    setFormErrors({})
  }

  function validateForm() {
    const errors: Record<string, string> = {}
    if (!formData.siteId) errors.siteId = 'Site is required'
    if (!formData.amount || parseFloat(formData.amount) <= 0) errors.amount = 'Valid amount is required'
    if (!formData.purpose.trim()) errors.purpose = 'Purpose is required'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  function handleCreate() {
    if (!validateForm()) return
    createMutation.mutate({
      siteId: formData.siteId,
      amount: parseFloat(formData.amount),
      purpose: formData.purpose.trim(),
      notes: formData.notes.trim() || undefined,
    })
  }

  function handleAction(action: string, advance: Advance) {
    setSelectedAdvance(advance)
    if (action === 'view') {
      setShowViewDialog(true)
    } else if (action === 'delete') {
      setShowDeleteDialog(true)
    } else if (action === 'reject' || action === 'return') {
      setReasonAction(action)
      setReason('')
      setShowReasonDialog(true)
    } else if (action === 'approve-accountant') {
      approveAccountantMutation.mutate(advance.id)
    } else if (action === 'approve-admin') {
      approveAdminMutation.mutate(advance.id)
    } else if (action === 'mark-paid') {
      markPaidMutation.mutate(advance.id)
    } else if (action === 'edit') {
      setFormData({
        siteId: advance.siteId,
        amount: String(advance.amount),
        purpose: advance.purpose,
        notes: advance.notes || '',
      })
      setShowAddDialog(true)
    }
  }

  function handleReasonSubmit() {
    if (!selectedAdvance || !reason.trim()) return
    if (reasonAction === 'reject') {
      rejectMutation.mutate({ id: selectedAdvance.id, reason: reason.trim() })
    } else if (reasonAction === 'return') {
      returnMutation.mutate({ id: selectedAdvance.id, reason: reason.trim() })
    }
  }

  function handleBulkUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      bulkUploadMutation.mutate(file)
    }
  }

  // Pagination helpers
  const advances = data?.advances || []
  const pagination = data?.pagination
  const totalPages = pagination?.totalPages || 1

  // Comment state
  const [commentText, setCommentText] = useState('')

  const handleAddComment = () => {
    if (!commentText.trim()) return
    addCommentMutation.mutate(commentText.trim())
    setCommentText('')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <BanknoteIcon className="w-7 h-7 text-amber-500" />
            {t.advances}
          </h2>
          <p className="text-sm text-navy-500 mt-1">
            Manage employee advance payments
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="border-navy-200 text-navy-700 hover:bg-navy-50"
            onClick={handleDownloadTemplate}
          >
            <Download className="w-4 h-4 mr-1.5" />
            Template
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleBulkUpload}
          />
          <Button
            variant="outline"
            size="sm"
            className="border-navy-200 text-navy-700 hover:bg-navy-50"
            onClick={() => fileInputRef.current?.click()}
            disabled={bulkUploadMutation.isPending}
          >
            <Upload className="w-4 h-4 mr-1.5" />
            {bulkUploadMutation.isPending ? 'Uploading...' : t.bulkUpload}
          </Button>
          <Button
            className="bg-amber-500 hover:bg-amber-600 text-white"
            onClick={() => { resetForm(); setShowAddDialog(true) }}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Advance
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="rounded-xl border-navy-100 bg-white p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
            <Input
              placeholder={t.search}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-9 border-navy-200 focus:border-amber-400 focus:ring-amber-400/20"
            />
          </div>
          <div className="flex gap-3">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[160px] border-navy-200">
                <Filter className="w-4 h-4 mr-1.5 text-navy-400" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="PENDING">{t.pending}</SelectItem>
                <SelectItem value="APPROVED">{t.approved}</SelectItem>
                <SelectItem value="PAID">{t.paid}</SelectItem>
                <SelectItem value="REJECTED">{t.rejected}</SelectItem>
                <SelectItem value="RETURNED">{t.returned}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={siteFilter} onValueChange={(v) => { setSiteFilter(v); setPage(1) }}>
              <SelectTrigger className="w-[180px] border-navy-200">
                <SelectValue placeholder={t.site} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Sites</SelectItem>
                {sites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="rounded-xl border-navy-100 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-navy-100 bg-navy-50/50">
                <TableHead className="text-navy-700 font-semibold">{t.date}</TableHead>
                <TableHead className="text-navy-700 font-semibold">Purpose</TableHead>
                <TableHead className="text-navy-700 font-semibold">{t.site}</TableHead>
                <TableHead className="text-navy-700 font-semibold">{t.amount}</TableHead>
                <TableHead className="text-navy-700 font-semibold">{t.status}</TableHead>
                <TableHead className="text-navy-700 font-semibold text-right">{t.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-navy-50">
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : advances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-navy-400">
                    {t.noData}
                  </TableCell>
                </TableRow>
              ) : (
                advances.map((advance) => (
                  <TableRow
                    key={advance.id}
                    className="border-navy-50 hover:bg-amber-50/30 transition-colors"
                  >
                    <TableCell className="text-sm text-navy-600">
                      {new Date(advance.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-navy-900 max-w-[200px] truncate">
                      {advance.purpose}
                    </TableCell>
                    <TableCell className="text-sm text-navy-600">
                      {advance.site.name}
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-navy-900">
                      ₹{advance.amount.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={advance.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => handleAction('view', advance)}>
                            <Eye className="w-4 h-4 mr-2" /> View Details
                          </DropdownMenuItem>
                          {advance.status === 'PENDING' && (
                            (user?.id === advance.userId || isAdmin) && (
                              <DropdownMenuItem onClick={() => handleAction('edit', advance)}>
                                <Pencil className="w-4 h-4 mr-2" /> {t.edit}
                              </DropdownMenuItem>
                            )
                          )}
                          {advance.status === 'PENDING' && (
                            (user?.id === advance.userId || isAdmin) && (
                              <DropdownMenuItem
                                onClick={() => handleAction('delete', advance)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> {t.delete}
                              </DropdownMenuItem>
                            )
                          )}
                          {(advance.status === 'PENDING' || advance.status === 'APPROVED') && canApprove && (
                            <>
                              <DropdownMenuSeparator />
                              {isAccountant && advance.status === 'PENDING' && (
                                <DropdownMenuItem onClick={() => handleAction('approve-accountant', advance)}>
                                  <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" /> Approve & Pay
                                </DropdownMenuItem>
                              )}
                              {isAdmin && advance.status === 'PENDING' && (
                                <DropdownMenuItem onClick={() => handleAction('approve-admin', advance)}>
                                  <CheckCircle2 className="w-4 h-4 mr-2 text-blue-600" /> {t.approve}
                                </DropdownMenuItem>
                              )}
                              {isAdmin && advance.status === 'APPROVED' && canMarkPaid && (
                                <DropdownMenuItem onClick={() => handleAction('mark-paid', advance)}>
                                  <Banknote className="w-4 h-4 mr-2 text-green-600" /> {t.markPaid}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleAction('reject', advance)} className="text-red-600 focus:text-red-600">
                                <XCircle className="w-4 h-4 mr-2" /> {t.reject}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAction('return', advance)} className="text-orange-600 focus:text-orange-600">
                                <RotateCcw className="w-4 h-4 mr-2" /> {t.return}
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

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-navy-900">
              {selectedAdvance ? t.edit : 'Add Advance'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="site" className="text-navy-700">{t.site} *</Label>
              <Select
                value={formData.siteId}
                onValueChange={(v) => setFormData((f) => ({ ...f, siteId: v }))}
              >
                <SelectTrigger id="site" className="border-navy-200">
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}{site.client ? ` — ${site.client.name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.siteId && (
                <p className="text-xs text-red-500">{formErrors.siteId}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount" className="text-navy-700">{t.amount} *</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                value={formData.amount}
                onChange={(e) => setFormData((f) => ({ ...f, amount: e.target.value }))}
                className="border-navy-200 focus:border-amber-400 focus:ring-amber-400/20"
              />
              {formErrors.amount && (
                <p className="text-xs text-red-500">{formErrors.amount}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="purpose" className="text-navy-700">Purpose *</Label>
              <Textarea
                id="purpose"
                placeholder="Enter purpose of advance"
                value={formData.purpose}
                onChange={(e) => setFormData((f) => ({ ...f, purpose: e.target.value }))}
                rows={3}
                className="border-navy-200 focus:border-amber-400 focus:ring-amber-400/20 resize-none"
              />
              {formErrors.purpose && (
                <p className="text-xs text-red-500">{formErrors.purpose}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes" className="text-navy-700">{t.notes}</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes (optional)"
                value={formData.notes}
                onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="border-navy-200 focus:border-amber-400 focus:ring-amber-400/20 resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowAddDialog(false)} className="border-navy-200">
              {t.cancel}
            </Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Saving...' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          {selectedAdvance && (
            <>
              <DialogHeader>
                <DialogTitle className="text-navy-900 flex items-center gap-2">
                  Advance Details
                  <StatusBadge status={selectedAdvance.status} />
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {/* Main info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide">Amount</p>
                    <p className="text-lg font-bold text-navy-900">
                      ₹{selectedAdvance.amount.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide">Purpose</p>
                    <p className="text-sm font-medium text-navy-800">{selectedAdvance.purpose}</p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide">{t.site}</p>
                    <p className="text-sm text-navy-800">{selectedAdvance.site.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide">Client</p>
                    <p className="text-sm text-navy-800">{selectedAdvance.site.client?.name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide">{t.user}</p>
                    <p className="text-sm text-navy-800">{selectedAdvance.user.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide">{t.date}</p>
                    <p className="text-sm text-navy-800">
                      {new Date(selectedAdvance.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                {/* Notes */}
                {selectedAdvance.notes && (
                  <div className="bg-navy-50 rounded-lg p-3">
                    <p className="text-xs text-navy-500 uppercase tracking-wide mb-1">{t.notes}</p>
                    <p className="text-sm text-navy-700">{selectedAdvance.notes}</p>
                  </div>
                )}

                {/* Rejection / Return reason */}
                {selectedAdvance.rejectionReason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-xs text-red-600 uppercase tracking-wide mb-1">Rejection Reason</p>
                    <p className="text-sm text-red-800">{selectedAdvance.rejectionReason}</p>
                  </div>
                )}
                {selectedAdvance.returnReason && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="text-xs text-orange-600 uppercase tracking-wide mb-1">Return Reason</p>
                    <p className="text-sm text-orange-800">{selectedAdvance.returnReason}</p>
                  </div>
                )}

                {/* Approval timeline */}
                <div className="space-y-2">
                  <p className="text-xs text-navy-500 uppercase tracking-wide font-semibold">Timeline</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-navy-600">
                      <div className="w-2 h-2 rounded-full bg-navy-300" />
                      Created: {new Date(selectedAdvance.createdAt).toLocaleString('en-IN')}
                    </div>
                    {selectedAdvance.adminApprovedAt && selectedAdvance.adminApprovedBy && (
                      <div className="flex items-center gap-2 text-blue-600">
                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                        Admin approved by {selectedAdvance.adminApprovedBy.name}:{' '}
                        {new Date(selectedAdvance.adminApprovedAt).toLocaleString('en-IN')}
                      </div>
                    )}
                    {selectedAdvance.accountantApprovedAt && selectedAdvance.accountantApprovedBy && (
                      <div className="flex items-center gap-2 text-green-600">
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                        Accountant approved by {selectedAdvance.accountantApprovedBy.name}:{' '}
                        {new Date(selectedAdvance.accountantApprovedAt).toLocaleString('en-IN')}
                      </div>
                    )}
                    {selectedAdvance.paidAt && selectedAdvance.paidBy && (
                      <div className="flex items-center gap-2 text-emerald-600">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        Paid by {selectedAdvance.paidBy.name}:{' '}
                        {new Date(selectedAdvance.paidAt).toLocaleString('en-IN')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Comments section */}
                <div className="border-t border-navy-100 pt-4">
                  <p className="text-xs text-navy-500 uppercase tracking-wide font-semibold mb-3">Comments</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {comments.length === 0 && (
                      <p className="text-sm text-navy-400 italic">No comments yet</p>
                    )}
                    {comments.map((c: any) => (
                      <div key={c.id} className="bg-navy-50 rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-navy-700">{c.user?.name || 'Unknown'}</span>
                          <span className="text-[10px] text-navy-400">
                            {new Date(c.createdAt).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <p className="text-sm text-navy-600">{c.content}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Input
                      placeholder="Add a comment..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                      className="border-navy-200 text-sm"
                    />
                    <Button
                      size="sm"
                      className="bg-amber-500 hover:bg-amber-600 text-white shrink-0"
                      onClick={handleAddComment}
                      disabled={!commentText.trim() || addCommentMutation.isPending}
                    >
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-navy-900">Delete Advance</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this advance? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-navy-200">{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => selectedAdvance && deleteMutation.mutate(selectedAdvance.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reason Dialog (Reject / Return) */}
      <Dialog open={showReasonDialog} onOpenChange={setShowReasonDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-navy-900">
              {reasonAction === 'reject' ? 'Reject Advance' : 'Return Advance'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reason" className="text-navy-700">{t.reason} *</Label>
              <Textarea
                id="reason"
                placeholder={`Enter ${reasonAction} reason...`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="border-navy-200 focus:border-amber-400 focus:ring-amber-400/20 resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowReasonDialog(false)} className="border-navy-200">
              {t.cancel}
            </Button>
            <Button
              className={
                reasonAction === 'reject'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-orange-500 hover:bg-orange-600 text-white'
              }
              onClick={handleReasonSubmit}
              disabled={!reason.trim() || rejectMutation.isPending || returnMutation.isPending}
            >
              {(reasonAction === 'reject' ? rejectMutation : returnMutation).isPending
                ? 'Processing...'
                : reasonAction === 'reject'
                  ? t.reject
                  : t.return}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
