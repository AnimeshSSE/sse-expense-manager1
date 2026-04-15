'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore, formatCurrency } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Edit, Trash2, Send, Check, X, Printer, ArrowLeft,
  UserCircle, Calendar, DollarSign, Building, AlertCircle, RotateCcw,
} from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface RequisitionDetailProps {
  onBack: () => void
  onEdit: () => void
  onPrint: () => void
}

const urgencyConfig: Record<string, { label: string; className: string }> = {
  LOW: { label: 'Low', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200' },
  NORMAL: { label: 'Normal', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200' },
  MEDIUM: { label: 'Medium', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200' },
  HIGH: { label: 'High', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200' },
}

export function RequisitionDetail({ onBack, onEdit, onPrint }: RequisitionDetailProps) {
  const { selectedRequisitionId, currentUser } = useAppStore()
  const queryClient = useQueryClient()
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [sendBackDialogOpen, setSendBackDialogOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['requisition', selectedRequisitionId],
    queryFn: () => fetch(`/api/requisitions/${selectedRequisitionId}`).then(res => res.json()),
    enabled: !!selectedRequisitionId,
  })

  const requisition = data?.requisition

  const submitMutation = useMutation({
    mutationFn: () => fetch('/api/requisitions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedRequisitionId, status: 'SUBMITTED' }),
    }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisition', selectedRequisitionId] })
      queryClient.invalidateQueries({ queryKey: ['requisitions'] })
      toast.success('Requisition submitted successfully')
    },
    onError: () => toast.error('Failed to submit requisition'),
  })

  const approveMutation = useMutation({
    mutationFn: () => fetch(`/api/requisitions/${selectedRequisitionId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', approverId: currentUser?.id, approverRole: currentUser?.role }),
    }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisition', selectedRequisitionId] })
      queryClient.invalidateQueries({ queryKey: ['requisitions'] })
      toast.success('Requisition approved')
    },
    onError: () => toast.error('Failed to approve requisition'),
  })

  const rejectMutation = useMutation({
    mutationFn: () => fetch(`/api/requisitions/${selectedRequisitionId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', approverId: currentUser?.id, approverRole: currentUser?.role, reason: rejectReason }),
    }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisition', selectedRequisitionId] })
      queryClient.invalidateQueries({ queryKey: ['requisitions'] })
      toast.success('Requisition rejected')
      setRejectDialogOpen(false)
      setRejectReason('')
    },
    onError: () => toast.error('Failed to reject requisition'),
  })

  const sendBackMutation = useMutation({
    mutationFn: () => fetch(`/api/requisitions/${selectedRequisitionId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send_back', approverId: currentUser?.id, approverRole: currentUser?.role, reason: rejectReason }),
    }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisition', selectedRequisitionId] })
      queryClient.invalidateQueries({ queryKey: ['requisitions'] })
      toast.success('Requisition sent back for revision')
      setSendBackDialogOpen(false)
      setRejectReason('')
    },
    onError: () => toast.error('Failed to send back requisition'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => fetch(`/api/requisitions/${selectedRequisitionId}`, { method: 'DELETE' }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisitions'] })
      toast.success('Requisition deleted')
      onBack()
    },
    onError: () => toast.error('Failed to delete requisition'),
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

  if (error || !requisition) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Requisition not found.</p>
      </div>
    )
  }

  const isAdmin = currentUser?.role === 'ADMIN'
  const isStockManager = currentUser?.role === 'STOCK_MANAGER'
  const isManager = currentUser?.role === 'MANAGER'
  const isCreator = currentUser?.id === requisition.userId
  const canEdit = (requisition.status === 'DRAFT' && isCreator) || (requisition.status === 'SUBMITTED' && (isStockManager || isAdmin))
  const canDelete = requisition.status === 'DRAFT' && isCreator
  const canSubmit = requisition.status === 'DRAFT' && isCreator
  const canApprove = requisition.status === 'SUBMITTED' && (isStockManager || isAdmin)
  const canReject = requisition.status === 'SUBMITTED' && (isStockManager || isAdmin)
  const canSendBack = requisition.status === 'SUBMITTED' && (isStockManager || isAdmin)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{requisition.title}</h1>
              <StatusBadge status={requisition.status} />
            </div>
            <p className="text-sm text-muted-foreground mt-1">{requisition.description || ''}</p>
            {requisition.rejectedReason && (
              <p className="text-sm text-destructive mt-1">Rejection reason: {requisition.rejectedReason}</p>
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
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <UserCircle className="h-4 w-4" />
                  Created By
                </div>
                <div>
                  <p className="font-medium">{requisition.user?.name || 'Unknown'}</p>
                  <p className="text-sm text-muted-foreground">{requisition.user?.department || ''}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Building className="h-4 w-4" />
                  Vendor Info
                </div>
                <div>
                  <p className="font-medium">{requisition.vendorName || '-'}</p>
                  <p className="text-sm text-muted-foreground">
                    Delivery: {requisition.deliveryDate ? format(new Date(requisition.deliveryDate), 'MMM d, yyyy') : '-'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  Total Amount
                </div>
                <p className="text-2xl font-bold text-primary">{formatCurrency(requisition.totalAmount)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  Urgency
                </div>
                <div className="flex flex-wrap gap-1">
                  {(requisition.items || []).map((item: { id: string; description: string; urgency: string }) => {
                    const config = urgencyConfig[item.urgency] || urgencyConfig.NORMAL
                    return (
                      <Badge key={item.id} variant="outline" className={config.className}>
                        {item.description}: {config.label}
                      </Badge>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Requisition Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-muted/30">
                    <TableHead>Description</TableHead>
                    <TableHead>Item Code</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Urgency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(requisition.items || []).map((item: { id: string; description: string; quantity: number; unitPrice: number; totalAmount: number; urgency: string; itemCode?: string | null }) => {
                    const config = urgencyConfig[item.urgency] || urgencyConfig.NORMAL
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.description}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">{item.itemCode || '-'}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.totalAmount)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={config.className}>{config.label}</Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <Separator className="my-4" />
              <div className="flex justify-end">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-xl font-bold">{formatCurrency(requisition.totalAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Department</span>
                <span className="font-medium">{requisition.department || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vendor</span>
                <span className="font-medium">{requisition.vendorName || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery Date</span>
                <span className="font-medium">{requisition.deliveryDate ? format(new Date(requisition.deliveryDate), 'MMM d, yyyy') : '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={requisition.status} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0 mt-0.5">
                    {requisition.user?.name?.split(' ').map(n => n[0]).join('') || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{requisition.user?.name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">
                      Created on {format(new Date(requisition.createdAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                {requisition.approvedBy && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-bold flex-shrink-0 mt-0.5">
                      {requisition.approvedBy.name?.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {requisition.status === 'REJECTED' ? 'Rejected' : 'Approved'} by {requisition.approvedBy.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {requisition.approvedAt && format(new Date(requisition.approvedAt), 'MMM d, yyyy')}
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
            <DialogTitle>Send Back Requisition</DialogTitle>
            <DialogDescription>Please provide a reason for sending this requisition back for revision.</DialogDescription>
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
            <DialogTitle>Reject Requisition</DialogTitle>
            <DialogDescription>Please provide a reason for rejecting this requisition.</DialogDescription>
          </DialogHeader>
          <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Enter rejection reason..." rows={3} />
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => rejectMutation.mutate()} disabled={!rejectReason.trim() || rejectMutation.isPending}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Requisition"
        description="Are you sure? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  )
}
