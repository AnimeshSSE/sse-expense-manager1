'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore, formatCurrency, departments } from '@/lib/store'
import { authGet, authPost, authPut } from '@/lib/fetch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface AdvanceFormInnerProps {
  advanceFormMode: 'create' | 'edit'
  selectedAdvanceId: string | null
  currentUser: { id: string; role: string; department: string } | null
  onClose: () => void
  onSubmit: (id: string) => void
}

function AdvanceFormInner({ advanceFormMode, selectedAdvanceId, currentUser, onClose, onSubmit }: AdvanceFormInnerProps) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [department, setDepartment] = useState(currentUser?.department || '')
  const [amount, setAmount] = useState(0)
  const [purpose, setPurpose] = useState('')
  const [expectedReturnDate, setExpectedReturnDate] = useState('')

  const { data: existingData, isLoading: isLoadingExisting } = useQuery({
    queryKey: ['advance', selectedAdvanceId],
    queryFn: () => authGet(`/api/advances/${selectedAdvanceId}`),
    enabled: advanceFormMode === 'edit' && !!selectedAdvanceId,
  })

  // Initialize form from fetched data (component remounts via key prop)
  useEffect(() => {
    const adv = existingData?.advance
    if (adv && advanceFormMode === 'edit') {
      /* eslint-disable react-hooks/set-state-in-effect */
      setTitle(adv.title)
      setDescription(adv.description || '')
      setDepartment(adv.department || currentUser?.department || '')
      setAmount(adv.amount)
      setPurpose(adv.purpose)
      setExpectedReturnDate(adv.expectedReturnDate ? new Date(adv.expectedReturnDate).toISOString().split('T')[0] : '')
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [existingData, advanceFormMode, currentUser?.department])

  const isEdit = advanceFormMode === 'edit'

  const createMutation = useMutation({
    mutationFn: (body: object) => authPost('/api/advances', body).then(res => res.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['advances'] })
      toast.success('Advance created')
      onSubmit(data.advance?.id || data.id)
    },
    onError: () => toast.error('Failed to create advance'),
  })

  const updateMutation = useMutation({
    mutationFn: (body: object) => authPut('/api/advances', body).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advances'] })
      queryClient.invalidateQueries({ queryKey: ['advance', selectedAdvanceId] })
      toast.success('Advance updated')
      onSubmit(selectedAdvanceId || '')
    },
    onError: () => toast.error('Failed to update advance'),
  })

  const handleSubmit = (status: 'DRAFT' | 'SUBMITTED') => {
    if (!title.trim()) { toast.error('Title is required'); return }
    if (!amount || amount <= 0) { toast.error('Amount must be greater than 0'); return }
    if (!purpose.trim()) { toast.error('Purpose is required'); return }

    const body = {
      title,
      description,
      department,
      amount,
      purpose,
      expectedReturnDate: expectedReturnDate || null,
      userId: currentUser?.id,
    }

    if (isEdit && selectedAdvanceId) {
      updateMutation.mutate({ ...body, id: selectedAdvanceId, status, userRole: currentUser?.role })
    } else {
      createMutation.mutate({ ...body, status })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (isLoadingExisting) {
    return (
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="space-y-4 py-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-10 w-full" /><Skeleton className="h-20 w-full" /></div>
      </DialogContent>
    )
  }

  return (
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit Cash Advance' : 'New Cash Advance Request'}</DialogTitle>
        <DialogDescription>
          {isEdit ? 'Update the cash advance details' : 'Fill in the cash advance request details'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-2">
        <div className="space-y-2">
          <Label htmlFor="adv-title">Title *</Label>
          <Input id="adv-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Conference Travel Advance" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="adv-desc">Description</Label>
          <Textarea id="adv-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Provide additional details" rows={3} />
        </div>

        <div className="space-y-2">
          <Label>Department *</Label>
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
            <SelectContent>
              {departments.map((dept) => (<SelectItem key={dept} value={dept}>{dept}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="adv-amount">Amount (₹) *</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
            <Input id="adv-amount" type="number" value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} placeholder="0.00" className="pl-7" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="adv-purpose">Purpose *</Label>
          <Textarea id="adv-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Explain the purpose of this advance" rows={2} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="adv-returndate">Expected Return Date *</Label>
          <Input id="adv-returndate" type="date" value={expectedReturnDate} onChange={(e) => setExpectedReturnDate(e.target.value)} />
        </div>
      </div>

      <DialogFooter className="flex-col sm:flex-row gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="secondary" onClick={() => handleSubmit('DRAFT')} disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Save as Draft
        </Button>
        <Button onClick={() => handleSubmit('SUBMITTED')} disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Submit
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

export function AdvanceForm() {
  const { advanceFormMode, selectedAdvanceId, currentUser, setAdvanceFormMode, setSelectedAdvanceId } = useAppStore()

  const isOpen = advanceFormMode === 'create' || advanceFormMode === 'edit'

  const handleClose = () => {
    setAdvanceFormMode('create')
    setSelectedAdvanceId(null)
  }

  const handleSubmit = (id: string) => {
    setSelectedAdvanceId(id)
    setAdvanceFormMode('view')
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      {isOpen && (
        <AdvanceFormInner
          key={`${advanceFormMode}-${selectedAdvanceId}`}
          advanceFormMode={advanceFormMode}
          selectedAdvanceId={selectedAdvanceId}
          currentUser={currentUser}
          onClose={handleClose}
          onSubmit={handleSubmit}
        />
      )}
    </Dialog>
  )
}
