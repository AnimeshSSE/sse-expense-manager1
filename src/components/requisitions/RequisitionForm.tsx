'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore, formatCurrency, departments } from '@/lib/store'
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
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { authGet, authPost, authPut } from '@/lib/fetch'

function generateId() {
  return Math.random().toString(36).substring(2, 9)
}

interface RequisitionFormItem {
  _tempId: string
  description: string
  quantity: number
  unitPrice: number
  urgency: string
  itemCode: string
}

const emptyItem = (): RequisitionFormItem => ({
  _tempId: generateId(),
  description: '',
  quantity: 1,
  unitPrice: 0,
  urgency: 'NORMAL',
  itemCode: '',
})

const INITIAL_ITEMS = [emptyItem()]

interface RequisitionFormInnerProps {
  requisitionFormMode: 'create' | 'edit'
  selectedRequisitionId: string | null
  currentUser: { id: string; role: string; department: string } | null
  onClose: () => void
  onSubmit: (id: string) => void
}

function RequisitionFormInner({ requisitionFormMode, selectedRequisitionId, currentUser, onClose, onSubmit }: RequisitionFormInnerProps) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [department, setDepartment] = useState(currentUser?.department || '')
  const [vendor, setVendor] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [items, setItems] = useState<RequisitionFormItem[]>(INITIAL_ITEMS)

  const { data: existingData, isLoading: isLoadingExisting } = useQuery({
    queryKey: ['requisition', selectedRequisitionId],
    queryFn: () => authGet(`/api/requisitions/${selectedRequisitionId}`),
    enabled: requisitionFormMode === 'edit' && !!selectedRequisitionId,
  })

  // Initialize form from fetched data (component remounts via key prop)
  useEffect(() => {
    const req = existingData?.requisition
    if (req && requisitionFormMode === 'edit') {
      /* eslint-disable react-hooks/set-state-in-effect */
      setTitle(req.title)
      setDescription(req.description || '')
      setDepartment(req.department || currentUser?.department || '')
      setVendor(req.vendorName || '')
      setDeliveryDate(req.deliveryDate ? new Date(req.deliveryDate).toISOString().split('T')[0] : '')
      if (req.items?.length > 0) {
        setItems(req.items.map((item: { id: string; description: string; quantity: number; unitPrice: number; urgency: string; itemCode?: string | null }) => ({
          _tempId: generateId(),
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          urgency: item.urgency,
          itemCode: item.itemCode || '',
        })))
      }
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [existingData, requisitionFormMode, currentUser?.department])

  const total = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0)
  const isEdit = requisitionFormMode === 'edit'

  const addItem = () => setItems([...items, emptyItem()])
  const removeItem = (tempId: string) => {
    if (items.length <= 1) return
    setItems(items.filter((i) => i._tempId !== tempId))
  }
  const updateItem = (tempId: string, field: keyof RequisitionFormItem, value: string | number) => {
    setItems(items.map((i) => (i._tempId === tempId ? { ...i, [field]: value } : i)))
  }

  const createMutation = useMutation({
    mutationFn: (body: object) => authPost('/api/requisitions', body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['requisitions'] })
      toast.success('Requisition created')
      onSubmit(data.requisition?.id || data.id)
    },
    onError: () => toast.error('Failed to create requisition'),
  })

  const updateMutation = useMutation({
    mutationFn: (body: object) => authPut('/api/requisitions', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisitions'] })
      queryClient.invalidateQueries({ queryKey: ['requisition', selectedRequisitionId] })
      toast.success('Requisition updated')
      onSubmit(selectedRequisitionId || '')
    },
    onError: () => toast.error('Failed to update requisition'),
  })

  const handleSubmit = (status: 'DRAFT' | 'SUBMITTED') => {
    if (!title.trim()) { toast.error('Title is required'); return }
    const validItems = items.filter(i => i.description.trim() && i.quantity > 0 && i.unitPrice > 0)
    if (validItems.length === 0) { toast.error('At least one valid item is required'); return }

    const body = {
      title,
      description,
      department,
      vendorName: vendor,
      deliveryDate,
      userId: currentUser?.id,
      items: validItems.map(i => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        urgency: i.urgency,
        itemCode: i.itemCode || undefined,
      })),
    }

    if (isEdit && selectedRequisitionId) {
      updateMutation.mutate({ ...body, id: selectedRequisitionId, status, userRole: currentUser?.role })
    } else {
      createMutation.mutate({ ...body, status })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (isLoadingExisting) {
    return (
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="space-y-4 py-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-10 w-full" /><Skeleton className="h-64 w-full" /></div>
      </DialogContent>
    )
  }

  return (
    <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit Requisition' : 'New Purchase Requisition'}</DialogTitle>
        <DialogDescription>
          {isEdit ? 'Update the requisition details' : 'Fill in the purchase requisition details'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="req-title">Title *</Label>
            <Input id="req-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Office Furniture Purchase" />
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
        </div>

        <div className="space-y-2">
          <Label htmlFor="req-desc">Description</Label>
          <Textarea id="req-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Provide details about this requisition" rows={3} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="req-vendor">Vendor *</Label>
            <Input id="req-vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Vendor name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="req-date">Delivery Date *</Label>
            <Input id="req-date" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Requisition Items *</Label>
            <Button variant="outline" size="sm" onClick={addItem} className="gap-1"><Plus className="h-3.5 w-3.5" />Add Item</Button>
          </div>

          <div className="space-y-3">
            {items.map((item) => (
              <div key={item._tempId} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr,80px,120px,100px,100px,40px] gap-3 p-3 rounded-lg border bg-muted/20">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Description</span>
                  <Input value={item.description} onChange={(e) => updateItem(item._tempId, 'description', e.target.value)} placeholder="Item description" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Qty</span>
                  <Input type="number" value={item.quantity || ''} onChange={(e) => updateItem(item._tempId, 'quantity', Number(e.target.value))} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Unit Price</span>
                  <Input type="number" value={item.unitPrice || ''} onChange={(e) => updateItem(item._tempId, 'unitPrice', Number(e.target.value))} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Urgency</span>
                  <Select value={item.urgency} onValueChange={(val) => updateItem(item._tempId, 'urgency', val)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="NORMAL">Normal</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Item Code</span>
                  <Input value={item.itemCode} onChange={(e) => updateItem(item._tempId, 'itemCode', e.target.value)} placeholder="Code" className="h-8 text-sm" />
                </div>
                <div className="flex items-end">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeItem(item._tempId)} disabled={items.length <= 1}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <div className="text-right">
              <span className="text-sm text-muted-foreground">Total: </span>
              <span className="text-xl font-bold">{formatCurrency(total)}</span>
            </div>
          </div>
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

export function RequisitionForm() {
  const { requisitionFormMode, selectedRequisitionId, currentUser, setRequisitionFormMode, setSelectedRequisitionId } = useAppStore()

  const isOpen = requisitionFormMode === 'create' || requisitionFormMode === 'edit'

  const handleClose = () => {
    setRequisitionFormMode('create')
    setSelectedRequisitionId(null)
  }

  const handleSubmit = (id: string) => {
    setSelectedRequisitionId(id)
    setRequisitionFormMode('view')
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      {isOpen && (
        <RequisitionFormInner
          key={`${requisitionFormMode}-${selectedRequisitionId}`}
          requisitionFormMode={requisitionFormMode}
          selectedRequisitionId={selectedRequisitionId}
          currentUser={currentUser}
          onClose={handleClose}
          onSubmit={handleSubmit}
        />
      )}
    </Dialog>
  )
}
