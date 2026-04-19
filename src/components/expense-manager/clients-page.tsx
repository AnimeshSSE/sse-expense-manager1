'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
import { Plus, Pencil, Trash2, Loader2, Building2, MapPin, Upload, Download, FileSpreadsheet, X, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react'

export function ClientsPage() {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [form, setForm] = useState({ name: '', description: '', isActive: true })

  // Bulk upload state
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkFile, setBulkFile] = useState<File | null>(null)
  const [bulkUploading, setBulkUploading] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ success: boolean; created: number; errors: { row: number; error: string }[] } | null>(null)
  const [bulkPreview, setBulkPreview] = useState<{ headers: string[]; rowCount: number } | null>(null)
  const [bulkDragActive, setBulkDragActive] = useState(false)
  const bulkFileInputRef = useRef<HTMLInputElement>(null)

  const expectedHeaders = ['Name', 'Description', 'IsActive']
  const requiredHeaders = ['Name']

  const handleBulkFileSelect = async (selectedFile: File) => {
    if (!selectedFile) return
    const ext = selectedFile.name.split('.').pop()?.toLowerCase()
    if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
      toast({ title: 'Invalid file', description: 'Please upload xlsx, xls, or csv files only', variant: 'destructive' }); return
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum file size is 5MB', variant: 'destructive' }); return
    }
    setBulkFile(selectedFile); setBulkResult(null)
    try {
      const XLSX = await import('xlsx')
      const buffer = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]
      if (jsonData.length > 0) {
        const headers = jsonData[0].map((h: any) => String(h || '').trim()).filter(Boolean)
        setBulkPreview({ headers, rowCount: jsonData.length - 1 })
      }
    } catch {
      toast({ title: 'Parse error', description: 'Could not preview file.', variant: 'destructive' })
    }
  }

  const handleBulkDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    setBulkDragActive(e.type === 'dragenter' || e.type === 'dragover')
  }

  const handleBulkDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setBulkDragActive(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleBulkFileSelect(f)
  }

  const handleBulkUpload = async () => {
    if (!bulkFile) return
    setBulkUploading(true)
    try {
      const formData = new FormData(); formData.append('file', bulkFile)
      const res = await fetch('/api/clients/bulk-upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) { toast({ title: 'Upload failed', description: data?.errors?.[0]?.error || 'Unknown error', variant: 'destructive' }); return }
      setBulkResult(data)
      if (data.created > 0) {
        toast({ title: 'Upload Complete', description: `${data.created} clients created${data.errors.length > 0 ? ` with ${data.errors.length} errors` : ''}` })
        loadClients()
      }
      if (data.created === 0 && data.errors.length > 0) toast({ title: 'Upload failed', description: 'All rows had errors.', variant: 'destructive' })
    } catch { toast({ title: 'Upload failed', description: 'Network error.', variant: 'destructive' }) }
    finally { setBulkUploading(false) }
  }

  const handleBulkDownloadTemplate = async () => {
    try {
      const res = await fetch('/api/clients/bulk-upload/template')
      if (!res.ok) throw new Error()
      const blob = await res.blob(); const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'client-bulk-upload-template.xlsx'
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
      toast({ title: 'Template downloaded', description: 'Fill in your data and upload' })
    } catch { toast({ title: 'Download failed', variant: 'destructive' }) }
  }

  const resetBulk = () => {
    setBulkFile(null); setBulkResult(null); setBulkPreview(null)
    if (bulkFileInputRef.current) bulkFileInputRef.current.value = ''
  }

  const handleBulkClose = () => { resetBulk(); setBulkOpen(false) }

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
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)} className="border-stone-300 hover:bg-stone-50">
            <Upload className="w-4 h-4 mr-2" />Bulk Upload
          </Button>
          <Button onClick={() => { setForm({ name: '', description: '', isActive: true }); setCreateOpen(true) }}
            className="bg-stone-900 hover:bg-stone-800">
            <Plus className="w-4 h-4 mr-2" />New Client
          </Button>
        </div>
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

      {/* Bulk Upload Dialog */}
      <Dialog open={bulkOpen} onOpenChange={handleBulkClose} modal>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Bulk Upload Clients
            </DialogTitle>
            <DialogDescription>Upload an xlsx, xls, or csv file with client data. Max 500 rows.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-stone-50 p-3 rounded-lg">
              <div className="text-sm">
                <span className="font-medium text-stone-700">Step 1:</span>{' '}
                <span className="text-stone-500">Download template, fill in your data</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleBulkDownloadTemplate}>
                <Download className="w-3.5 h-3.5 mr-1.5" />Download Template
              </Button>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-stone-700">Step 2: Upload your file</Label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                  bulkDragActive ? 'border-stone-900 bg-stone-50' : bulkFile ? 'border-green-300 bg-green-50' : 'border-stone-300 hover:border-stone-400'
                }`}
                onDragEnter={handleBulkDrag} onDragLeave={handleBulkDrag} onDragOver={handleBulkDrag} onDrop={handleBulkDrop}
                onClick={() => bulkFileInputRef.current?.click()}
              >
                <input ref={bulkFileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBulkFileSelect(f) }} />
                {bulkFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileSpreadsheet className="w-8 h-8 text-green-600" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-stone-900">{bulkFile.name}</p>
                      <p className="text-xs text-stone-500">
                        {(bulkFile.size / 1024).toFixed(1)} KB
                        {bulkPreview && ` · ${bulkPreview.rowCount} data rows · ${bulkPreview.headers.length} columns`}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 ml-2" onClick={(e) => { e.stopPropagation(); resetBulk() }}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-8 h-8 mx-auto text-stone-400 mb-2" />
                    <p className="text-sm text-stone-600 font-medium">Drag & drop or click to upload</p>
                    <p className="text-xs text-stone-400 mt-1">Supports .xlsx, .xls, .csv (max 5MB)</p>
                  </div>
                )}
              </div>
            </div>
            {bulkPreview && !bulkResult && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-stone-700">Step 3: Preview & verify</Label>
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-stone-50 px-3 py-2 border-b">
                    <p className="text-xs text-stone-600">
                      <span className="font-medium">{bulkPreview.rowCount}</span> rows detected with{' '}
                      <span className="font-medium">{bulkPreview.headers.length}</span> columns
                    </p>
                  </div>
                  <div className="p-3 flex flex-wrap gap-1.5">
                    {expectedHeaders.map((h) => {
                      const found = bulkPreview.headers.some(
                        (ph) => ph.toLowerCase().replace(/[\s_]+/g, '') === h.toLowerCase().replace(/[\s_]+/g, '')
                      )
                      const isRequired = requiredHeaders.includes(h)
                      return (
                        <Badge key={h} variant="outline" className={`text-[10px] px-1.5 py-0 ${
                          found ? 'border-green-300 bg-green-50 text-green-700'
                            : isRequired ? 'border-red-300 bg-red-50 text-red-700'
                            : 'border-stone-300 bg-stone-50 text-stone-400'
                        }`}>
                          {found ? <CheckCircle2 className="w-2.5 h-2.5 mr-0.5 inline" /> : null}
                          {!found && isRequired ? <AlertCircle className="w-2.5 h-2.5 mr-0.5 inline" /> : null}
                          {h}
                          {isRequired && !found && <span className="text-red-500 ml-0.5">*</span>}
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
            {bulkResult && (
              <div className="space-y-3">
                {bulkResult.created > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                    <p className="text-sm font-medium text-green-800">{bulkResult.created} clients created successfully</p>
                  </div>
                )}
                {bulkResult.errors.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="px-3 py-2 border-b border-amber-200 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <p className="text-xs font-medium text-amber-800">{bulkResult.errors.length} row(s) had errors</p>
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      <Table>
                        <TableHeader><TableRow><TableHead className="text-xs w-16">Row</TableHead><TableHead className="text-xs">Error</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {bulkResult.errors.map((err, i) => (
                            <TableRow key={i}><TableCell className="text-xs font-medium">{err.row}</TableCell><TableCell className="text-xs text-red-700">{err.error}</TableCell></TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleBulkClose}>{bulkResult ? 'Close' : 'Cancel'}</Button>
            {!bulkResult && (
              <Button onClick={handleBulkUpload} disabled={!bulkFile || bulkUploading} className="bg-stone-900 hover:bg-stone-800">
                {bulkUploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</> : <><Upload className="w-4 h-4 mr-2" />Upload {bulkFile ? `(${bulkPreview?.rowCount || 0} rows)` : ''}</>}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
