'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/lib/store'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { GenericBulkUploadDialog } from '@/components/shared/GenericBulkUploadDialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Upload, Edit, Trash2 } from 'lucide-react'
import { CategoryForm, type CategoryData } from './CategoryForm'
import { toast } from 'sonner'
import { authGet, authDelete } from '@/lib/fetch'

export function CategoryList() {
  const { currentUser } = useAppStore()
  const queryClient = useQueryClient()
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CategoryData | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const isAdmin = currentUser?.role === 'ADMIN'

  const { data, isLoading, error } = useQuery<{ categories: CategoryData[]; total: number }>({
    queryKey: ['categories'],
    queryFn: () => authGet('/api/categories?limit=100'),
    enabled: isAdmin,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => authDelete(`/api/categories?id=${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Category deleted successfully')
      setDeleteId(null)
    },
    onError: () => toast.error('Failed to delete category'),
  })

  const categories: CategoryData[] = data?.categories || []

  const columns: Column<CategoryData>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (item) => (
        <span className="font-medium text-sm">{item.name}</span>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      render: (item) => (
        <span className="text-sm font-mono text-muted-foreground">{item.code}</span>
      ),
    },
    {
      key: 'itemsCount',
      header: 'Items Count',
      render: (item) => (
        <span className="text-sm">{item._count?.expenseItems || 0}</span>
      ),
    },
  ]

  const handleAddCategory = () => {
    setEditingCategory(null)
    setShowCategoryForm(true)
  }

  const handleEditCategory = (category: CategoryData) => {
    setEditingCategory(category)
    setShowCategoryForm(true)
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <p className="text-muted-foreground">Access denied. Admin only.</p>
      </div>
    )
  }

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
        <p className="text-muted-foreground">Failed to load categories.</p>
        <button onClick={() => queryClient.invalidateQueries({ queryKey: ['categories'] })} className="text-primary hover:underline">Retry</button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-muted-foreground">Manage expense categories</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowBulkUpload(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Bulk Upload
          </Button>
          <Button onClick={handleAddCategory} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
        </div>
      </div>

      <DataTable<CategoryData>
        tableName="categories"
        columns={columns}
        data={categories}
        searchPlaceholder="Search categories..."
        actions={(item) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => { e.stopPropagation(); handleEditCategory(item) }}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); setDeleteId(item.id) }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      />

      <GenericBulkUploadDialog
        open={showBulkUpload}
        onOpenChange={setShowBulkUpload}
        entity="categories"
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['categories'] })}
      />

      <CategoryForm
        open={showCategoryForm}
        onOpenChange={setShowCategoryForm}
        category={editingCategory}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Delete Category"
        description="Are you sure you want to delete this category? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}
