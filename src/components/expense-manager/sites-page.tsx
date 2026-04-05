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
import { Plus, Pencil, Trash2, Loader2, MapPin } from 'lucide-react'

export function SitesPage() {
  const [sites, setSites] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [form, setForm] = useState({
    clientId: '', name: '', location: '', description: '', budget: '',
    isActive: true,
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [s, c] = await Promise.all([api.getSites(), api.getClients()])
      setSites(s || []); setClients(c || [])
    } catch { /* handled */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleCreate = async () => {
    if (!form.clientId || !form.name.trim()) {
      toast({ title: 'Error', description: 'Client and name are required', variant: 'destructive' }); return
    }
    setActionLoading(true)
    try {
      await api.createSite({ ...form, budget: parseFloat(form.budget) || 0 })
      toast({ title: 'Success', description: 'Site created' })
      setCreateOpen(false)
      setForm({ clientId: '', name: '', location: '', description: '', budget: '', isActive: true })
      loadData()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const handleEdit = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' }); return
    }
    setActionLoading(true)
    try {
      await api.updateSite(selected.id, { ...form, budget: parseFloat(form.budget) || 0 })
      toast({ title: 'Success', description: 'Site updated' })
      setEditOpen(false); loadData()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const handleDelete = async () => {
    setActionLoading(true)
    try {
      await api.deleteSite(selected.id)
      toast({ title: 'Success', description: 'Site deleted' })
      setDeleteOpen(false); loadData()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const openEdit = (site: any) => {
    setSelected(site)
    setForm({
      clientId: site.clientId, name: site.name, location: site.location || '',
      description: site.description || '', budget: site.budget?.toString() || '',
      isActive: site.isActive,
    })
    setEditOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Sites</h2>
          <p className="text-sm text-stone-500">Manage project sites</p>
        </div>
        <Button onClick={() => { setForm({ clientId: '', name: '', location: '', description: '', budget: '', isActive: true }); setCreateOpen(true) }}
          className="bg-stone-900 hover:bg-stone-800">
          <Plus className="w-4 h-4 mr-2" />New Site
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Client</TableHead>
                <TableHead className="text-xs">Location</TableHead>
                <TableHead className="text-xs">Budget</TableHead>
                <TableHead className="text-xs">Expenses</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>{[...Array(7)].map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}</TableRow>
                ))
              ) : sites.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-stone-400 text-sm">
                    <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />No sites found
                  </TableCell>
                </TableRow>
              ) : (
                sites.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs font-medium">{s.name}</TableCell>
                    <TableCell className="text-xs">{s.client?.name || '-'}</TableCell>
                    <TableCell className="text-xs">{s.location || '-'}</TableCell>
                    <TableCell className="text-xs">Rs {s.budget?.toLocaleString()}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="text-[10px]">{s._count?.expenses || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${s.isActive ? 'bg-green-100 text-green-800' : 'bg-stone-100 text-stone-500'}`}>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-stone-500 hover:text-red-600"
                          onClick={() => { setSelected(s); setDeleteOpen(true) }}>
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
          <DialogHeader><DialogTitle>Create Site</DialogTitle><DialogDescription>Add a new project site</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input className="h-9 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Site name" />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input className="h-9 text-sm" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Site location" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea className="text-sm min-h-[60px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Budget (Rs)</Label>
              <Input type="number" className="h-9 text-sm" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="0.00" />
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
          <DialogHeader><DialogTitle>Edit Site</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input className="h-9 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input className="h-9 text-sm" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea className="text-sm min-h-[60px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Budget (Rs)</Label>
              <Input type="number" className="h-9 text-sm" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
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
            <AlertDialogTitle>Delete Site</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This will affect associated expenses and requisitions.</AlertDialogDescription>
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
