'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore, formatCurrency, type Expense } from '@/lib/store'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Eye, Trash2, Upload } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { authGet, authDelete } from '@/lib/fetch'
import { GenericBulkUploadDialog } from '@/components/shared/GenericBulkUploadDialog'

interface ExpenseListProps {
  onCreateNew: () => void
  onViewDetail: (id: string) => void
}

export function ExpenseList({ onCreateNew, onViewDetail }: ExpenseListProps) {
  const { expenseFormMode, selectedExpenseId, currentUser } = useAppStore()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState<string>('createdAt')
  const [sortDir, setSortDir] = useState<string>('desc')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showBulkUpload, setShowBulkUpload] = useState(false)

  const { data, isLoading, error } = useQuery<{ expenses: Expense[]; total: number; totalPages: number }>({
    queryKey: ['expenses', statusFilter, sortBy, sortDir, currentUser?.id],
    queryFn: () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      params.set('sortBy', sortBy)
      params.set('sortDir', sortDir)
      params.set('limit', '50')
      if (currentUser?.id) params.set('userId', currentUser.id)
      if (currentUser?.role) params.set('userRole', currentUser.role)
      return authGet(`/api/expenses?${params}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => authDelete(`/api/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Expense deleted successfully')
      setDeleteId(null)
    },
    onError: () => {
      toast.error('Failed to delete expense')
    },
  })

  const expenses: Expense[] = data?.expenses || []

  const columns: Column<Expense>[] = [
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
      key: 'totalAmount',
      header: 'Amount',
      render: (item) => (
        <span className="text-sm font-medium">{formatCurrency(item.totalAmount)}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (item) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(item.createdAt), 'MMM d, yyyy')}
        </span>
      ),
    },
  ]

  const showList = !selectedExpenseId || expenseFormMode === 'create'

  if (!showList) return null

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-48 mt-2" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <p className="text-muted-foreground">Failed to load expenses.</p>
        <button onClick={() => queryClient.invalidateQueries({ queryKey: ['expenses'] })} className="text-primary hover:underline">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-muted-foreground">Manage and track expense reports</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowBulkUpload(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Bulk Upload
          </Button>
          <Button onClick={onCreateNew} className="gap-2">
            <Plus className="h-4 w-4" />
            New Expense
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
            <SelectItem value="PAID">Paid</SelectItem>
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
            <SelectItem value="totalAmount-desc">Amount: High to Low</SelectItem>
            <SelectItem value="totalAmount-asc">Amount: Low to High</SelectItem>
            <SelectItem value="title-asc">Title: A-Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable<Expense>
        tableName="expenses"
        columns={columns}
        data={expenses}
        onRowClick={(item) => onViewDetail(item.id)}
        searchPlaceholder="Search expenses..."
        actions={(item) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation()
                onViewDetail(item.id)
              }}
            >
              <Eye className="h-4 w-4" />
            </Button>
            {item.status === 'DRAFT' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteId(item.id)
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Delete Expense"
        description="Are you sure you want to delete this expense? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />

      <GenericBulkUploadDialog
        open={showBulkUpload}
        onOpenChange={setShowBulkUpload}
        entity="expenses"
        userId={currentUser?.id}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['expenses'] })}
      />
    </div>
  )
}
