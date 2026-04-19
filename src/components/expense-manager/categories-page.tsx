'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Plus, Pencil, Trash2, Loader2, Tags } from 'lucide-react'

const CATEGORY_TYPES = ['EXPENSE', 'REQUISITION', 'BOTH']

export function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [form, setForm] = useState({ name: '', type: 'BOTH', description: '', isActive: true })

  const loadCategories = useCallback(async () => {
    setLoading(true)
    try { setCategories(await api.getCategories() || []) } catch { /* handled */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadCategories() }, [loadCategories])

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' }); return
    }
    setActionLoading(true)
    try {
      await api.createCategory(form)
      toast({ title: 'Success', description: 'Category created' })
      setCreateOpen(false)
      setForm({ name: '', type: 'BOTH', description: '', isActive: true })
      loadCategories()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const handleEdit = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' }); return
    }
    setActionLoading(true)
    try {
      await api.updateCategory(selected.id, form)
      toast({ title: 'Success', description: 'Category updated' })
      setEditOpen(false); loadCategories()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const handleDelete = async () => {
    setActionLoading(true)
    try {
      await api.deleteCategory(selected.id)
      toast({ title: 'Success', description: 'Category deleted' })
      setDeleteOpen(false); loadCategories()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const openEdit = (cat: any) => {
    setSelected(cat)
    setForm({ name: cat.name, type: cat.type, description: cat.description || '', isActive: cat.isActive })
    setEditOpen(true)
  }

  const typeColors: Record<string, string> = {
    EXPENSE: 'bg-amber-100 text-amber-800',
    REQUISITION: 'bg-cyan-100 text-cyan-800',
    BOTH: 'bg-emerald-100 text-emerald-800',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Categories</h2>
          <p className="text-sm text-stone-500">Manage expense and requisition categories</p>
        </div>
        <Button onClick={() => { setForm({ name: '', type: 'BOTH', description: '', isActive: true }); setCreateOpen(true) }}
          className="bg-stone-900 hover:bg-stone-800">
          <Plus className="w-4 h-4 mr-2" />New Category
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Description</TableHead>
                <TableHead className="text-xs">Expenses</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>{[...Array(6)].map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}</TableRow>
                ))
              ) : categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-stone-400 text-sm">
                    <Tags className="w-8 h-8 mx-auto mb-2 opacity-30" />No categories found
                  </TableCell>
                </TableRow>
              ) : (
                categories.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs font-medium">{c.name}</TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${typeColors[c.type] || ''}`}>{c.type}</Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{c.description || '-'}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="text-[10px]">{c._count?.expenses || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${c.isActive ? 'bg-green-100 text-green-800' : 'bg-stone-100 text-stone-500'}`}>
                        {c.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-stone-500 hover:text-red-600"
                          onClick={() => { setSelected(c); setDeleteOpen(true) }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create Category</DialogTitle><DialogDescription>Add a new category</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input className="h-9 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Category name" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea className="text-sm min-h-[60px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.isActive} onCheckedChange={(c) => setForm({ ...form, isActive: !!c })} />
              <Label className="text-sm">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={actionLoading} className="bg-stone-900 hover:bg-stone-800">
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit Category</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input className="h-9 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORY_TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea className="text-sm min-h-[60px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.isActive} onCheckedChange={(c) => setForm({ ...form, isActive: !!c })} />
              <Label className="text-sm">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={actionLoading} className="bg-stone-900 hover:bg-stone-800">
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? Expenses using this category will be affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={actionLoading} className="bg-destructive hover:bg-destructive/90">
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
