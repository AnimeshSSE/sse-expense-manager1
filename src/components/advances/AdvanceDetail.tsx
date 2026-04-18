'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore, formatCurrency, type Advance } from '@/lib/store'
import { authGet, authPut, authPost } from '@/lib/fetch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Edit, Send, Check, X, Printer, ArrowLeft,
  UserCircle, Calendar, DollarSign, Wallet, RotateCcw,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface AdvanceDetailProps {
  onBack: () => void
  onEdit: () => void
  onPrint: () => void
}

export function AdvanceDetail({ onBack, onEdit, onPrint }: AdvanceDetailProps) {
  const { selectedAdvanceId, currentUser } = useAppStore()
  const queryClient = useQueryClient()
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [sendBackDialogOpen, setSendBackDialogOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const { data, isLoading, error } = useQuery<{ advance: Advance }>({
    queryKey: ['advance', selectedAdvanceId],
    queryFn: () => authGet(`/api/advances/${selectedAdvanceId}`),
    enabled: !!selectedAdvanceId,
  })

  const advance = data?.advance

  const submitMutation = useMutation({
    mutationFn: () => authPut('/api/advances', { id: selectedAdvanceId, status: 'SUBMITTED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advance', selectedAdvanceId] })
      queryClient.invalidateQueries({ queryKey: ['advances'] })
      toast.success('Advance submitted successfully')
    },
    onError: () => toast.error('Failed to submit advance'),
  })

  const approveMutation = useMutation({
    mutationFn: () => authPost(`/api/advances/${selectedAdvanceId}/approve`, { action: 'approve', approverId: currentUser?.id, approverRole: currentUser?.role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advance', selectedAdvanceId] })
      queryClient.invalidateQueries({ queryKey: ['advances'] })
      toast.success('Advance approved')
    },
    onError: () => toast.error('Failed to approve advance'),
  })

  const rejectMutation = useMutation({
    mutationFn: () => authPost(`/api/advances/${selectedAdvanceId}/approve`, { action: 'reject', approverId: currentUser?.id, approverRole: currentUser?.role, reason: rejectReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advance', selectedAdvanceId] })
      queryClient.invalidateQueries({ queryKey: ['advances'] })
      toast.success('Advance rejected')
      setRejectDialogOpen(false)
      setRejectReason('')
    },
    onError: () => toast.error('Failed to reject advance'),
  })

  const sendBackMutation = useMutation({
    mutationFn: () => authPost(`/api/advances/${selectedAdvanceId}/approve`, { action: 'send_back', approverId: currentUser?.id, approverRole: currentUser?.role, reason: rejectReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advance', selectedAdvanceId] })
      queryClient.invalidateQueries({ queryKey: ['advances'] })
      toast.success('Advance sent back for revision')
      setSendBackDialogOpen(false)
      setRejectReason('')
    },
    onError: () => toast.error('Failed to send back advance'),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  if (error || !advance) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Advance not found.</p>
      </div>
    )
  }

  const isAdmin = currentUser?.role === 'ADMIN'
  const isManager = currentUser?.role === 'MANAGER'
  const isStockManager = currentUser?.role === 'STOCK_MANAGER'
  const isCreator = currentUser?.id === advance.userId
  const canEdit = (advance.status === 'DRAFT' && isCreator) || (advance.status === 'SUBMITTED' && (isStockManager || isAdmin))
  const canSubmit = advance.status === 'DRAFT' && isCreator
  const canApprove = advance.status === 'SUBMITTED' && (isManager || isAdmin)
  const canReject = advance.status === 'SUBMITTED' && (isManager || isAdmin)
  const canSendBack = advance.status === 'SUBMITTED' && (isManager || isAdmin)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{advance.title}</h1>
              <StatusBadge status={advance.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">{advance.description || ''}</p>
            {advance.rejectedReason && (
              <p className="text-sm text-destructive mt-1">Rejection reason: {advance.rejectedReason}</p>
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
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  Advance Amount
                </div>
                <p className="text-2xl font-bold text-primary">{formatCurrency(advance.amount)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Expected Return
                </div>
                <p className="text-lg font-semibold">
                  {advance.expectedReturnDate ? format(new Date(advance.expectedReturnDate), 'MMMM d, yyyy') : '-'}
                </p>
                {advance.expectedReturnDate && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(advance.expectedReturnDate) > new Date()
                      ? `${Math.ceil((new Date(advance.expectedReturnDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days remaining`
                      : 'Past due'}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <UserCircle className="h-4 w-4" />
                  Requested By
                </div>
                <div>
                  <p className="font-medium">{advance.user?.name || 'Unknown'}</p>
                  <p className="text-sm text-muted-foreground">{advance.user?.department || ''}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Wallet className="h-4 w-4" />
                  Settlement
                </div>
                {advance.settlementDate ? (
                  <div>
                    <p className="font-medium">{formatCurrency(advance.settlementAmount || 0)}</p>
                    <p className="text-xs text-muted-foreground">
                      Settled on {format(new Date(advance.settlementDate), 'MMM d, yyyy')}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not yet settled</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Purpose</h3>
                <p className="text-sm">{advance.purpose}</p>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Department:</span>
                  <p className="font-medium">{advance.department || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <div className="mt-1"><StatusBadge status={advance.status} /></div>
                </div>
                <div>
                  <span className="text-muted-foreground">Created:</span>
                  <p className="font-medium">{format(new Date(advance.createdAt), 'MMM d, yyyy')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0 mt-0.5">
                    {advance.user?.name?.split(' ').map(n => n[0]).join('') || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{advance.user?.name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">
                      Created on {format(new Date(advance.createdAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>

                {advance.submittedDate && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-bold flex-shrink-0 mt-0.5">
                      {advance.user?.name?.split(' ').map(n => n[0]).join('') || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Submitted</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(advance.submittedDate), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                )}

                {advance.approvedBy && advance.approvedAt && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-bold flex-shrink-0 mt-0.5">
                      {advance.approvedBy.name?.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {advance.status === 'REJECTED' ? 'Rejected' : 'Approved'} by {advance.approvedBy.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(advance.approvedAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                )}

                {advance.settlementDate && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400 text-xs font-bold flex-shrink-0 mt-0.5">
                      FA
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Settled - {formatCurrency(advance.settlementAmount || 0)}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(advance.settlementDate), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
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
            <DialogTitle>Send Back Advance</DialogTitle>
            <DialogDescription>Please provide a reason for sending this advance back for revision.</DialogDescription>
          </DialogHeader>
          <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Enter reason for sending back..." rows={3} />
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
            <DialogTitle>Reject Advance</DialogTitle>
            <DialogDescription>Please provide a reason for rejecting this advance.</DialogDescription>
          </DialogHeader>
          <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Enter rejection reason..." rows={3} />
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejectMutation.mutate()} disabled={!rejectReason.trim() || rejectMutation.isPending}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
