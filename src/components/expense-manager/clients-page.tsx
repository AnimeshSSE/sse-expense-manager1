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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Plus, Pencil, Trash2, Loader2, Building2, MapPin } from 'lucide-react'

export function ClientsPage() {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [form, setForm] = useState({ name: '', description: '', isActive: true })

  const loadClients = useCallback(async () => {
    setLoading(true)
    try { setClients(await api.getClients() || []) } catch { /* handled */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadClients() }, [loadClients])

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' }); return
    }
    setActionLoading(true)
    try {
      await api.createClient(form)
      toast({ title: 'Success', description: 'Client created' })
      setCreateOpen(false); setForm({ name: '', description: '', isActive: true }); loadClients()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const handleEdit = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' }); return
    }
    setActionLoading(true)
    try {
      await api.updateClient(selectedClient.id, form)
      toast({ title: 'Success', description: 'Client updated' })
      setEditOpen(false); loadClients()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const handleDelete = async () => {
    setActionLoading(true)
    try {
      await api.deleteClient(selectedClient.id)
      toast({ title: 'Success', description: 'Client deleted' })
      setDeleteOpen(false); loadClients()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const openEdit = (client: any) => {
    setSelectedClient(client)
    setForm({ name: client.name, description: client.description || '', isActive: client.isActive })
    setEditOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Clients</h2>
          <p className="text-sm text-stone-500">Manage client organizations</p>
        </div>
        <Button onClick={() => { setForm({ name: '', description: '', isActive: true }); setCreateOpen(true) }}
          className="bg-stone-900 hover:bg-stone-800">
          <Plus className="w-4 h-4 mr-2" />New Client
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Description</TableHead>
                <TableHead className="text-xs">Sites</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i}>{[...Array(5)].map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}</TableRow>
                ))
              ) : clients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-stone-400 text-sm">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />No clients found
                  </TableCell>
                </TableRow>
              ) : (
                clients.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs font-medium">{c.name}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{c.description || '-'}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="text-[10px]">{c._count?.sites || 0} sites</Badge>
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
                          onClick={() => { setSelectedClient(c); setDeleteOpen(true) }}>
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
          <DialogHeader><DialogTitle>Create Client</DialogTitle><DialogDescription>Add a new client</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input className="h-9 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Client name" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea className="text-sm min-h-[80px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Client description..." />
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
          <DialogHeader><DialogTitle>Edit Client</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input className="h-9 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea className="text-sm min-h-[80px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This will also affect associated sites and expenses.</AlertDialogDescription>
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
