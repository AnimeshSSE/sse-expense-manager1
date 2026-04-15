'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore, formatCurrency, type Requisition } from '@/lib/store'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Eye, Trash2, AlertCircle, Upload } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { GenericBulkUploadDialog } from '@/components/shared/GenericBulkUploadDialog'

interface RequisitionListProps {
  onCreateNew: () => void
  onViewDetail: (id: string) => void
}

const urgencyConfig: Record<string, { label: string; className: string }> = {
  LOW: { label: 'Low', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  NORMAL: { label: 'Normal', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  MEDIUM: { label: 'Medium', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  HIGH: { label: 'High', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

export function RequisitionList({ onCreateNew, onViewDetail }: RequisitionListProps) {
  const { requisitionFormMode, selectedRequisitionId, currentUser } = useAppStore()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showBulkUpload, setShowBulkUpload] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['requisitions', statusFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      params.set('limit', '50')
      return fetch(`/api/requisitions?${params}`).then(res => res.json())
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/requisitions/${id}`, { method: 'DELETE' }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisitions'] })
      toast.success('Requisition deleted successfully')
      setDeleteId(null)
    },
    onError: () => toast.error('Failed to delete requisition'),
  })

  const requisitions: Requisition[] = data?.requisitions || []

  const columns: Column<Requisition>[] = [
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
      key: 'vendorName',
      header: 'Vendor',
      render: (item) => (
        <span className="text-sm">{item.vendorName || '-'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'totalAmount',
      header: 'Amount',
      render: (item) => (
        <span className="text-sm font-medium">{formatCurrency(item.totalAmount)}</span>
      ),
    },
    {
      key: 'urgency',
      header: 'Urgency',
      render: (item) => {
        const maxUrgency = (item.items || []).reduce((max, i) => {
          const order: Record<string, number> = { LOW: 0, NORMAL: 0, MEDIUM: 1, HIGH: 2 }
          return order[i.urgency] > order[max] ? i.urgency : max
        }, 'LOW' as string)
        const config = urgencyConfig[maxUrgency] || urgencyConfig.NORMAL
        return (
          <Badge variant="outline" className={config.className}>
            <AlertCircle className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        )
      },
    },
  ]

  const showList = !selectedRequisitionId || requisitionFormMode === 'create'

  if (!showList) return null

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <p className="text-muted-foreground">Failed to load requisitions.</p>
        <button onClick={() => queryClient.invalidateQueries({ queryKey: ['requisitions'] })} className="text-primary hover:underline">Retry</button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Requisitions</h1>
          <p className="text-muted-foreground">Manage purchase requisitions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowBulkUpload(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Bulk Upload
          </Button>
          <Button onClick={onCreateNew} className="gap-2">
            <Plus className="h-4 w-4" />
            New Requisition
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
            <SelectItem value="FULFILLED">Fulfilled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable<Requisition>
        tableName="requisitions"
        columns={columns}
        data={requisitions }
        onRowClick={(item) => onViewDetail(item.id)}
        searchPlaceholder="Search requisitions..."
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
        title="Delete Requisition"
        description="Are you sure? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />

      <GenericBulkUploadDialog
        open={showBulkUpload}
        onOpenChange={setShowBulkUpload}
        entity="requisitions"
        userId={currentUser?.id}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['requisitions'] })}
      />
    </div>
  )
}
