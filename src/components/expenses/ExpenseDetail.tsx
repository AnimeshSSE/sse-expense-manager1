'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore, formatCurrency, type Expense } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Edit,
  Trash2,
  Send,
  Check,
  X,
  Printer,
  ArrowLeft,
  UserCircle,
  Calendar,
  DollarSign,
  FileText,
  RotateCcw,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { authGet, authPost, authPut, authDelete } from '@/lib/fetch'

interface ExpenseDetailProps {
  onBack: () => void
  onEdit: () => void
  onPrint: () => void
}

export function ExpenseDetail({ onBack, onEdit, onPrint }: ExpenseDetailProps) {
  const { selectedExpenseId, currentUser } = useAppStore()
  const queryClient = useQueryClient()
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [sendBackDialogOpen, setSendBackDialogOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const { data, isLoading, error } = useQuery<{ expense: Expense }>({
    queryKey: ['expense', selectedExpenseId],
    queryFn: () => authGet(`/api/expenses/${selectedExpenseId}`),
    enabled: !!selectedExpenseId,
  })

  const expense = data?.expense

  const submitMutation = useMutation({
    mutationFn: () => authPut('/api/expenses', { id: selectedExpenseId, status: 'SUBMITTED', userRole: currentUser?.role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense', selectedExpenseId] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Expense submitted successfully')
    },
    onError: () => toast.error('Failed to submit expense'),
  })

  const approveMutation = useMutation({
    mutationFn: () => authPost(`/api/expenses/${selectedExpenseId}/approve`, { action: 'approve', approverId: currentUser?.id, approverRole: currentUser?.role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense', selectedExpenseId] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Expense approved')
    },
    onError: () => toast.error('Failed to approve expense'),
  })

  const rejectMutation = useMutation({
    mutationFn: () => authPost(`/api/expenses/${selectedExpenseId}/approve`, { action: 'reject', approverId: currentUser?.id, approverRole: currentUser?.role, reason: rejectReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense', selectedExpenseId] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Expense rejected')
      setRejectDialogOpen(false)
      setRejectReason('')
    },
    onError: () => toast.error('Failed to reject expense'),
  })

  const sendBackMutation = useMutation({
    mutationFn: () => authPost(`/api/expenses/${selectedExpenseId}/approve`, { action: 'send_back', approverId: currentUser?.id, approverRole: currentUser?.role, reason: rejectReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense', selectedExpenseId] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Expense sent back for revision')
      setSendBackDialogOpen(false)
      setRejectReason('')
    },
    onError: () => toast.error('Failed to send back expense'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => authDelete(`/api/expenses/${selectedExpenseId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success('Expense deleted')
      onBack()
    },
    onError: () => toast.error('Failed to delete expense'),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (error || !expense) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Expense not found.</p>
      </div>
    )
  }

  const isAdmin = currentUser?.role === 'ADMIN'
  const isManager = currentUser?.role === 'MANAGER'
  const isStockManager = currentUser?.role === 'STOCK_MANAGER'
  const isCreator = currentUser?.id === expense.userId
  const canEdit = (expense.status === 'DRAFT' && isCreator) || (expense.status === 'SUBMITTED' && (isStockManager || isAdmin))
  const canDelete = expense.status === 'DRAFT' && isCreator
  const canSubmit = expense.status === 'DRAFT' && isCreator
  const canApprove = expense.status === 'SUBMITTED' && (isManager || isAdmin)
  const canReject = expense.status === 'SUBMITTED' && (isManager || isAdmin)
  const canSendBack = expense.status === 'SUBMITTED' && (isManager || isAdmin)

  const getCategoryName = (cat: unknown) => {
    if (typeof cat === 'string') return cat
    if (typeof cat === 'object' && cat !== null && 'name' in cat) return (cat as { name: string }).name
    return 'Unknown'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{expense.title}</h1>
              <StatusBadge status={expense.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">{expense.description || ''}</p>
            {expense.rejectedReason && (
              <p className="text-sm text-destructive mt-1">Rejection reason: {expense.rejectedReason}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={onEdit} className="gap-1.5">
              <Edit className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
          {canDelete && (
            <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setDeleteDialogOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          )}
          {canSubmit && (
            <Button size="sm" className="gap-1.5" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
              <Send className="h-3.5 w-3.5" />
              Submit
            </Button>
          )}
          {canApprove && (
            <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
              <Check className="h-3.5 w-3.5" />
              Approve
            </Button>
          )}
          {canReject && (
            <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => setRejectDialogOpen(true)}>
              <X className="h-3.5 w-3.5" />
              Reject
            </Button>
          )}
          {canSendBack && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSendBackDialogOpen(true)}>
              <RotateCcw className="h-3.5 w-3.5" />
              Send Back
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onPrint} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Info + Items */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <UserCircle className="h-4 w-4" />
                  Created By
                </div>
                <div>
                  <p className="font-medium">{expense.user?.name || 'Unknown'}</p>
                  <p className="text-sm text-muted-foreground">{expense.user?.department || ''}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  Total Amount
                </div>
                <p className="text-2xl font-bold text-primary">{formatCurrency(expense.totalAmount)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Dates
                </div>
                <div className="space-y-1 text-sm">
                  <p>Created: {format(new Date(expense.createdAt), 'MMM d, yyyy')}</p>
                  {expense.submittedDate && (
                    <p>Submitted: {format(new Date(expense.submittedDate), 'MMM d, yyyy')}</p>
                  )}
                  {expense.approvedAt && (
                    <p>Approved: {format(new Date(expense.approvedAt), 'MMM d, yyyy')}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  Details
                </div>
                <div className="space-y-1 text-sm">
                  <p>Department: <span className="font-medium">{expense.department || '-'}</span></p>
                  <p>Items: <span className="font-medium">{expense.items?.length || 0}</span></p>
                  <p>Status: <StatusBadge status={expense.status} /></p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Expense Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-muted/30">
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expense.items?.map((item: { id: string; description: string; amount: number; date: string; category: unknown }) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs">
                          {getCategoryName(item.category)}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(item.date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Separator className="my-4" />
              <div className="flex justify-end">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-xl font-bold">{formatCurrency(expense.totalAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Timeline */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Approval History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0 mt-0.5">
                    {expense.user?.name?.split(' ').map(n => n[0]).join('') || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{expense.user?.name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">
                      Created on {format(new Date(expense.createdAt), 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                </div>

                {expense.submittedDate && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-bold flex-shrink-0 mt-0.5">
                      {expense.user?.name?.split(' ').map(n => n[0]).join('') || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Submitted</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(expense.submittedDate), 'MMM d, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                )}

                {expense.approvedBy && expense.approvedAt && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-bold flex-shrink-0 mt-0.5">
                      {expense.approvedBy.name?.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {expense.status === 'REJECTED' ? 'Rejected' : 'Approved'} by {expense.approvedBy.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(expense.approvedAt), 'MMM d, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                )}

                {expense.status === 'DRAFT' && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No approval history yet.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Send Back Dialog */}
      <Dialog open={sendBackDialogOpen} onOpenChange={setSendBackDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Back Expense</DialogTitle>
            <DialogDescription>Please provide a reason for sending this expense back for revision.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter reason for sending back..."
            rows={3}
          />
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setSendBackDialogOpen(false); setRejectReason('') }}>Cancel</Button>
            <Button onClick={() => sendBackMutation.mutate()} disabled={!rejectReason.trim() || sendBackMutation.isPending}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Send Back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Expense</DialogTitle>
            <DialogDescription>Please provide a reason for rejecting this expense.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter rejection reason..."
            rows={3}
          />
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejectMutation.mutate()} disabled={!rejectReason.trim() || rejectMutation.isPending}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Expense"
        description="Are you sure you want to delete this expense? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  )
}
