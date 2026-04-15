'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore, formatCurrency, departments } from '@/lib/store'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

function generateId() {
  return Math.random().toString(36).substring(2, 9)
}

interface FormItem {
  _tempId: string
  description: string
  amount: number
  date: string
  categoryId: string
}

const emptyItem = (): FormItem => ({
  _tempId: generateId(),
  description: '',
  amount: 0,
  date: new Date().toISOString().split('T')[0],
  categoryId: '',
})

const INITIAL_ITEMS = [emptyItem()]

interface ExpenseFormInnerProps {
  expenseFormMode: 'create' | 'edit'
  selectedExpenseId: string | null
  currentUser: { id: string; role: string; department: string } | null
  onClose: () => void
  onSubmit: (id: string) => void
}

function ExpenseFormInner({ expenseFormMode, selectedExpenseId, currentUser, onClose, onSubmit }: ExpenseFormInnerProps) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [department, setDepartment] = useState(currentUser?.department || '')
  const [items, setItems] = useState<FormItem[]>(INITIAL_ITEMS)

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => fetch('/api/categories').then(res => res.json()),
  })

  const { data: existingData, isLoading: isLoadingExisting } = useQuery({
    queryKey: ['expense', selectedExpenseId],
    queryFn: () => fetch(`/api/expenses/${selectedExpenseId}`).then(res => res.json()),
    enabled: expenseFormMode === 'edit' && !!selectedExpenseId,
  })

  // Initialize form from fetched data (component remounts via key prop)
  useEffect(() => {
    const exp = existingData?.expense
    if (exp && expenseFormMode === 'edit') {
      /* eslint-disable react-hooks/set-state-in-effect */
      setTitle(exp.title)
      setDescription(exp.description || '')
      setDepartment(exp.department || currentUser?.department || '')
      if (exp.items?.length > 0) {
        setItems(exp.items.map((item: { id: string; description: string; amount: number; date: string; categoryId: string }) => ({
          _tempId: generateId(),
          description: item.description,
          amount: item.amount,
          date: new Date(item.date).toISOString().split('T')[0],
          categoryId: item.categoryId,
        })))
      }
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [existingData, expenseFormMode, currentUser?.department])

  const categories = categoriesData?.categories || []

  const total = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  const isEdit = expenseFormMode === 'edit'

  const addItem = () => setItems([...items, emptyItem()])

  const removeItem = (tempId: string) => {
    if (items.length <= 1) return
    setItems(items.filter((i) => i._tempId !== tempId))
  }

  const updateItem = (tempId: string, field: keyof FormItem, value: string | number) => {
    setItems(items.map((i) => (i._tempId === tempId ? { ...i, [field]: value } : i)))
  }

  const createMutation = useMutation({
    mutationFn: (body: object) => fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(res => res.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      toast.success(isEdit ? 'Expense updated' : 'Expense created')
      onSubmit(data.expense?.id || data.id)
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Failed to save expense'
      toast.error(msg)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (body: object) => fetch('/api/expenses', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(res => res.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['expense', selectedExpenseId] })
      toast.success('Expense updated')
      onSubmit(selectedExpenseId || data.expense?.id)
    },
    onError: () => toast.error('Failed to update expense'),
  })

  const handleSubmit = (status: 'DRAFT' | 'SUBMITTED') => {
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }

    const validItems = items.filter(i => i.description.trim() && i.amount > 0 && i.categoryId)
    if (validItems.length === 0) {
      toast.error('At least one valid item is required')
      return
    }

    const body = {
      title,
      description,
      department,
      userId: currentUser?.id,
      items: validItems.map(i => ({
        description: i.description,
        amount: i.amount,
        date: i.date,
        categoryId: i.categoryId,
      })),
    }

    if (isEdit && selectedExpenseId) {
      updateMutation.mutate({ ...body, id: selectedExpenseId, status, userRole: currentUser?.role })
    } else {
      createMutation.mutate({ ...body, status })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  if (isLoadingExisting) {
    return (
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="space-y-4 py-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </DialogContent>
    )
  }

  return (
    <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit Expense' : 'New Expense Report'}</DialogTitle>
        <DialogDescription>
          {isEdit ? 'Update the expense report details' : 'Fill in the expense report details'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-2">
        <div className="space-y-2">
          <Label htmlFor="exp-title">Title *</Label>
          <Input
            id="exp-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Q1 Office Supplies"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="exp-desc">Description</Label>
          <Textarea
            id="exp-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Provide details about this expense"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>Department *</Label>
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger>
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((dept) => (
                <SelectItem key={dept} value={dept}>{dept}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Expense Items *</Label>
            <Button variant="outline" size="sm" onClick={addItem} className="gap-1">
              <Plus className="h-3.5 w-3.5" />
              Add Item
            </Button>
          </div>

          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item._tempId}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr,120px,140px,140px,40px] gap-3 p-3 rounded-lg border bg-muted/20"
              >
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Description</span>
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(item._tempId, 'description', e.target.value)}
                    placeholder="Item description"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Amount</span>
                  <Input
                    type="number"
                    value={item.amount || ''}
                    onChange={(e) => updateItem(item._tempId, 'amount', Number(e.target.value))}
                    placeholder="0.00"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Date</span>
                  <Input
                    type="date"
                    value={item.date}
                    onChange={(e) => updateItem(item._tempId, 'date', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Category</span>
                  <Select
                    value={item.categoryId}
                    onValueChange={(val) => updateItem(item._tempId, 'categoryId', val)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat: { id: string; name: string }) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeItem(item._tempId)}
                    disabled={items.length <= 1}
                  >
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
          {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          Save as Draft
        </Button>
        <Button onClick={() => handleSubmit('SUBMITTED')} disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          Submit
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

export function ExpenseForm() {
  const {
    expenseFormMode,
    selectedExpenseId,
    currentUser,
    setExpenseFormMode,
    setSelectedExpenseId,
  } = useAppStore()

  const isOpen = expenseFormMode === 'create' || expenseFormMode === 'edit'

  const handleClose = () => {
    setExpenseFormMode('create')
    setSelectedExpenseId(null)
  }

  const handleSubmit = (id: string) => {
    setSelectedExpenseId(id)
    setExpenseFormMode('view')
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      {isOpen && (
        <ExpenseFormInner
          key={`${expenseFormMode}-${selectedExpenseId}`}
          expenseFormMode={expenseFormMode}
          selectedExpenseId={selectedExpenseId}
          currentUser={currentUser}
          onClose={handleClose}
          onSubmit={handleSubmit}
        />
      )}
    </Dialog>
  )
}
