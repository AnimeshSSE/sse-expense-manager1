'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useLanguage } from '@/hooks/use-language'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, MoreHorizontal, Pencil, Trash2, Tags } from 'lucide-react'
import { toast } from 'sonner'

interface Category {
  id: string
  name: string
  type: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count: { expenses: number }
}

interface CategoryFormData {
  name: string
  type: string
  description: string
  isActive: boolean
}

const emptyForm: CategoryFormData = { name: '', type: 'BOTH', description: '', isActive: true }

const TYPE_BADGES: Record<string, { label: string; className: string }> = {
  EXPENSE: { label: 'Expense', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  REQUISITION: { label: 'Requisition', className: 'bg-purple-100 text-purple-700 hover:bg-purple-100' },
  BOTH: { label: 'Both', className: 'bg-amber-100 text-amber-700 hover:bg-amber-100' },
}

export function CategoriesPage() {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [filterType, setFilterType] = useState<string>('')
  const [filterActive, setFilterActive] = useState<string>('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null)
  const [form, setForm] = useState<CategoryFormData>(emptyForm)

  const params: Record<string, string> = { page: String(page), pageSize: '20' }
  if (search) params.search = search
  if (filterType) params.type = filterType
  if (filterActive) params.isActive = filterActive

  const { data, isLoading } = useQuery({
    queryKey: ['categories', page, search, filterType, filterActive],
    queryFn: () => api.getCategories(params) as Promise<{ data: Category[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>,
  })

  const createMutation = useMutation({
    mutationFn: (data: CategoryFormData) => api.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Category created successfully')
      closeDialog()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CategoryFormData }) => api.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Category updated successfully')
      closeDialog()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Category deleted successfully')
      setDeleteOpen(false)
      setDeletingCategory(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const openCreate = () => {
    setEditingCategory(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (category: Category) => {
    setEditingCategory(category)
    setForm({
      name: category.name,
      type: category.type,
      description: category.description || '',
      isActive: category.isActive,
    })
    setDialogOpen(true)
  }

  const openDelete = (category: Category) => {
    setDeletingCategory(category)
    setDeleteOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingCategory(null)
    setForm(emptyForm)
  }

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error('Category name is required')
      return
    }
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data: form })
    } else {
      createMutation.mutate(form)
    }
  }

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(1)
  }

  const pagination = data?.pagination

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Tags className="w-5 h-5 text-navy-700" />
          <h2 className="text-lg font-semibold text-navy-900">Categories</h2>
          {pagination && (
            <Badge variant="secondary" className="text-xs">
              {pagination.total} total
            </Badge>
          )}
        </div>
        <Button onClick={openCreate} className="bg-amber-500 hover:bg-amber-600 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-navy-100 p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex gap-2">
          <Input
            placeholder="Search categories..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="max-w-xs"
          />
          <Button variant="outline" onClick={handleSearch} size="default">
            Search
          </Button>
          {(search || filterType || filterActive) && (
            <Button
              variant="ghost"
              onClick={() => { setSearch(''); setSearchInput(''); setFilterType(''); setFilterActive(''); setPage(1) }}
            >
              Clear
            </Button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={filterType} onValueChange={v => { setFilterType(v === 'all_types' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_types">All Types</SelectItem>
              <SelectItem value="EXPENSE">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Expense
                </span>
              </SelectItem>
              <SelectItem value="REQUISITION">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  Requisition
                </span>
              </SelectItem>
              <SelectItem value="BOTH">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Both
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          {['', 'true', 'false'].map(val => (
            <Button
              key={val}
              variant={filterActive === val ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setFilterActive(val); setPage(1) }}
              className={filterActive === val ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}
            >
              {val === '' ? 'All' : val === 'true' ? 'Active' : 'Inactive'}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-navy-50/50 hover:bg-navy-50/50">
                <TableHead className="font-semibold text-navy-700">Name</TableHead>
                <TableHead className="font-semibold text-navy-700">Type</TableHead>
                <TableHead className="font-semibold text-navy-700">Description</TableHead>
                <TableHead className="font-semibold text-navy-700">Status</TableHead>
                <TableHead className="font-semibold text-navy-700 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-60" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : !data?.data?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-navy-400">
                    {t.noData}
                  </TableCell>
                </TableRow>
              ) : (
                data.data.map(category => {
                  const typeBadge = TYPE_BADGES[category.type] || TYPE_BADGES.BOTH
                  return (
                    <TableRow key={category.id} className="hover:bg-navy-50/30">
                      <TableCell className="font-medium text-navy-900">{category.name}</TableCell>
                      <TableCell>
                        <Badge className={typeBadge.className}>
                          {typeBadge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-navy-500 max-w-xs truncate">
                        {category.description || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={category.isActive
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-red-100 text-red-700 hover:bg-red-100'
                        }>
                          {category.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(category)} className="cursor-pointer">
                              <Pencil className="w-4 h-4 mr-2" />
                              {t.edit}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openDelete(category)}
                              disabled={category._count.expenses > 0}
                              className="cursor-pointer text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              {t.delete}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-navy-100">
            <p className="text-sm text-navy-500">
              Showing {((pagination.page - 1) * pagination.pageSize) + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </Button>
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === pagination.totalPages || Math.abs(p - pagination.page) <= 1)
                .map((p, i, arr) => (
                  <span key={p} className="flex items-center">
                    {i > 0 && arr[i - 1] !== p - 1 && <span className="px-1 text-navy-400">...</span>}
                    <Button
                      variant={p === pagination.page ? 'default' : 'outline'}
                      size="sm"
                      className={p === pagination.page ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  </span>
                ))}
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) closeDialog(); else setDialogOpen(true) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-navy-900">
              {editingCategory ? 'Edit Category' : 'Add Category'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Name <span className="text-red-500">*</span></Label>
              <Input
                id="cat-name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Category name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-type">Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      Expense
                    </span>
                  </SelectItem>
                  <SelectItem value="REQUISITION">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      Requisition
                    </span>
                  </SelectItem>
                  <SelectItem value="BOTH">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Both
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-desc">Description</Label>
              <Textarea
                id="cat-desc"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional description"
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-navy-100 p-3">
              <div>
                <Label htmlFor="cat-active" className="text-sm font-medium text-navy-900">Active</Label>
                <p className="text-xs text-navy-500">Inactive categories won't appear in dropdowns</p>
              </div>
              <Switch
                id="cat-active"
                checked={form.isActive}
                onCheckedChange={checked => setForm(f => ({ ...f, isActive: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              {t.cancel}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingCategory?.name}</strong>? This action cannot be undone.
              {deletingCategory && deletingCategory._count.expenses > 0 && (
                <span className="block mt-2 text-red-600 font-medium">
                  This category has {deletingCategory._count.expenses} expense(s). Please delete or reassign them first.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCategory && deleteMutation.mutate(deletingCategory.id)}
              disabled={deleteMutation.isPending || (deletingCategory ? deletingCategory._count.expenses > 0 : false)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? 'Deleting...' : t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
