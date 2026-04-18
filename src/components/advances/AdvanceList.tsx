'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore, formatCurrency, type Advance } from '@/lib/store'
import { authGet, authDelete } from '@/lib/fetch'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Eye, Trash2, Upload } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { GenericBulkUploadDialog } from '@/components/shared/GenericBulkUploadDialog'

interface AdvanceListProps {
  onCreateNew: () => void
  onViewDetail: (id: string) => void
}

export function AdvanceList({ onCreateNew, onViewDetail }: AdvanceListProps) {
  const { advanceFormMode, selectedAdvanceId, currentUser } = useAppStore()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState<string>('createdAt')
  const [sortDir, setSortDir] = useState<string>('desc')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showBulkUpload, setShowBulkUpload] = useState(false)

  const { data, isLoading, error } = useQuery<{ advances: Advance[]; total: number; totalPages: number }>({
    queryKey: ['advances', statusFilter, sortBy, sortDir, currentUser?.id],
    queryFn: () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      params.set('sortBy', sortBy)
      params.set('sortDir', sortDir)
      params.set('limit', '50')
      if (currentUser?.id) params.set('userId', currentUser.id)
      if (currentUser?.role) params.set('userRole', currentUser.role)
      return authGet(`/api/advances?${params}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => authDelete(`/api/advances/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advances'] })
      toast.success('Advance deleted successfully')
      setDeleteId(null)
    },
    onError: () => toast.error('Failed to delete advance'),
  })

  const advances: Advance[] = data?.advances || []

  const columns: Column<Advance>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (item) => (
        <div>
          <p className="font-medium text-sm">{item.title}</p>
          <p className="text-xs text-muted-foreground max-w-[200px] truncate">{item.description || ''}</p>
        </div>
      ),
    },
    {
      key: 'user',
      header: 'User',
      render: (item) => (
        <span className="text-sm">{item.user?.name || 'Unknown'}</span>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (item) => (
        <span className="text-sm">{item.department || '-'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (item) => (
        <span className="text-sm font-medium">{formatCurrency(item.amount)}</span>
      ),
    },
    {
      key: 'purpose',
      header: 'Purpose',
      render: (item) => (
        <span className="text-sm max-w-[150px] truncate block">{item.purpose}</span>
      ),
    },
    {
      key: 'expectedReturnDate',
      header: 'Expected Return',
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {item.expectedReturnDate ? format(new Date(item.expectedReturnDate), 'MMM d, yyyy') : '-'}
        </span>
      ),
    },
  ]

  const showList = !selectedAdvanceId || advanceFormMode === 'create'

  if (!showList) return null

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <p className="text-muted-foreground">Failed to load advances.</p>
        <button onClick={() => queryClient.invalidateQueries({ queryKey: ['advances'] })} className="text-primary hover:underline">Retry</button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cash Advances</h1>
          <p className="text-muted-foreground">Manage cash advance requests</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowBulkUpload(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Bulk Upload
          </Button>
          <Button onClick={onCreateNew} className="gap-2">
            <Plus className="h-4 w-4" />
            New Advance
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="DISBURSED">Disbursed</SelectItem>
            <SelectItem value="SETTLED">Settled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={`${sortBy}-${sortDir}`} onValueChange={(val) => {
          const [s, d] = val.split('-')
          setSortBy(s)
          setSortDir(d)
        }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt-desc">Newest First</SelectItem>
            <SelectItem value="createdAt-asc">Oldest First</SelectItem>
            <SelectItem value="amount-desc">Amount: High to Low</SelectItem>
            <SelectItem value="amount-asc">Amount: Low to High</SelectItem>
            <SelectItem value="title-asc">Title: A-Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable<Advance>
        tableName="advances"
        columns={columns}
        data={advances }
        onRowClick={(item) => onViewDetail(item.id)}
        searchPlaceholder="Search advances..."
        actions={(item) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onViewDetail(item.id) }}>
              <Eye className="h-4 w-4" />
            </Button>
            {item.status === 'DRAFT' && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(item.id) }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Delete Advance"
        description="Are you sure? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />

      <GenericBulkUploadDialog
        open={showBulkUpload}
        onOpenChange={setShowBulkUpload}
        entity="advances"
        userId={currentUser?.id}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['advances'] })}
      />
    </div>
  )
}
