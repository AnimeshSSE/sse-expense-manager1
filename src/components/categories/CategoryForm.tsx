'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { authPost, authPut } from '@/lib/fetch'

export interface CategoryData {
  id: string
  name: string
  code: string
  _count?: { expenses: number }
  status: 'ACTIVE' | 'INACTIVE'
}

interface CategoryFormInnerProps {
  category: CategoryData | null
  onClose: () => void
}

function CategoryFormInner({ category, onClose }: CategoryFormInnerProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(category?.name ?? '')
  const [code, setCode] = useState(category?.code ?? '')

  const isEdit = !!category

  const createMutation = useMutation({
    mutationFn: (body: object) => authPost('/api/categories', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Category created successfully')
      onClose()
    },
    onError: () => toast.error('Failed to create category'),
  })

  const updateMutation = useMutation({
    mutationFn: (body: object) => authPut('/api/categories', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Category updated successfully')
      onClose()
    },
    onError: () => toast.error('Failed to update category'),
  })

  const handleSubmit = () => {
    if (!name.trim() || !code.trim()) {
      toast.error('Name and code are required')
      return
    }

    const body = { name, code }

    if (isEdit && category?.id) {
      updateMutation.mutate({ ...body, id: category.id })
    } else {
      createMutation.mutate(body)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit Category' : 'Add New Category'}</DialogTitle>
        <DialogDescription>
          {isEdit ? 'Update category information' : 'Fill in the new category details'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="cat-name">Category Name *</Label>
          <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Travel" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cat-code">Category Code *</Label>
          <Input id="cat-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. TRAVEL" />
        </div>
      </div>

      <DialogFooter className="flex-col sm:flex-row gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {isEdit ? 'Save Changes' : 'Create Category'}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

interface CategoryFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: CategoryData | null
}

export function CategoryForm({ open, onOpenChange, category }: CategoryFormProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <CategoryFormInner
          key={category?.id ?? 'new'}
          category={category}
          onClose={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  )
}
