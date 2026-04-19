'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Plus, Pencil, Trash2, Loader2, Users, AlertTriangle, Upload, Download, FileSpreadsheet, X, CheckCircle2, AlertCircle } from 'lucide-react'

const ROLES = ['ADMIN', 'ACCOUNTANT', 'STOCK_MANAGER', 'USER']

const SortIcon = ({ field, sortField, sortDir }: { field: string; sortField: string; sortDir: string }) => {
  if (field !== sortField) return <span className="ml-1 opacity-20 text-[10px]">▲▼</span>
  return <span className="ml-1 text-[10px]">{sortDir === 'asc' ? '▲' : '▼'}</span>
}

const roleColors: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-800',
  ACCOUNTANT: 'bg-cyan-100 text-cyan-800',
  STOCK_MANAGER: 'bg-emerald-100 text-emerald-800',
  USER: 'bg-stone-100 text-stone-800',
}

export function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: 'USER' })
  const [editForm, setEditForm] = useState({ name: '', role: 'USER', isActive: true })
  const [sortField, setSortField] = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc')

  // Bulk upload state
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkFile, setBulkFile] = useState<File | null>(null)
  const [bulkUploading, setBulkUploading] = useState(false)
  const [bulkResult, setBulkResult] = useState<{ success: boolean; created: number; errors: { row: number; error: string }[] } | null>(null)
  const [bulkPreview, setBulkPreview] = useState<{ headers: string[]; rowCount: number } | null>(null)
  const [bulkDragActive, setBulkDragActive] = useState(false)
  const bulkFileInputRef = useRef<HTMLInputElement>(null)

  const expectedHeaders = ['Name', 'Email', 'Password', 'Role']
  const requiredHeaders = ['Name', 'Email', 'Password']

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
      const res = await fetch('/api/users/bulk-upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) { toast({ title: 'Upload failed', description: data?.errors?.[0]?.error || 'Unknown error', variant: 'destructive' }); return }
      setBulkResult(data)
      if (data.created > 0) {
        toast({ title: 'Upload Complete', description: `${data.created} users created${data.errors.length > 0 ? ` with ${data.errors.length} errors` : ''}` })
        loadUsers()
      }
      if (data.created === 0 && data.errors.length > 0) toast({ title: 'Upload failed', description: 'All rows had errors.', variant: 'destructive' })
    } catch { toast({ title: 'Upload failed', description: 'Network error.', variant: 'destructive' }) }
    finally { setBulkUploading(false) }
  }

  const handleBulkDownloadTemplate = async () => {
    try {
      const res = await fetch('/api/users/bulk-upload/template')
      if (!res.ok) throw new Error()
      const blob = await res.blob(); const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'user-bulk-upload-template.xlsx'
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
      toast({ title: 'Template downloaded', description: 'Fill in your data and upload' })
    } catch { toast({ title: 'Download failed', variant: 'destructive' }) }
  }

  const resetBulk = () => {
    setBulkFile(null); setBulkResult(null); setBulkPreview(null)
    if (bulkFileInputRef.current) bulkFileInputRef.current.value = ''
  }

  const handleBulkClose = () => { resetBulk(); setBulkOpen(false) }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try { setUsers(await api.getUsers({ sortBy: sortField, sortOrder: sortDir }) || []) } catch { /* handled */ }
    finally { setLoading(false) }
  }, [sortField, sortDir])

  useEffect(() => { loadUsers() }, [loadUsers])

  const handleCreate = async () => {
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password) {
      toast({ title: 'Error', description: 'All fields are required', variant: 'destructive' }); return
    }
    setActionLoading(true)
    try {
      await api.createUser(createForm)
      toast({ title: 'Success', description: 'User created' })
      setCreateOpen(false)
      setCreateForm({ name: '', email: '', password: '', role: 'USER' })
      loadUsers()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const handleEdit = async () => {
    if (!editForm.name.trim()) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' }); return
    }
    setActionLoading(true)
    try {
      await api.updateUser(selected.id, editForm)
      toast({ title: 'Success', description: 'User updated' })
      setEditOpen(false); loadUsers()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const handleDelete = async () => {
    if (selected.id === currentUser?.id) {
      toast({ title: 'Error', description: 'You cannot delete your own account', variant: 'destructive' }); return
    }
    setActionLoading(true)
    try {
      await api.deleteUser(selected.id)
      toast({ title: 'Success', description: 'User deleted' })
      setDeleteOpen(false); loadUsers()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const openEdit = (u: any) => {
    setSelected(u)
    setEditForm({ name: u.name, role: u.role, isActive: u.isActive })
    setEditOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Users</h2>
          <p className="text-sm text-stone-500">Manage system users and roles</p>
        </div>
        <div className="flex items-center gap-2">
          {currentUser?.role === 'ADMIN' && (
            <Button variant="outline" onClick={() => setBulkOpen(true)} className="border-stone-300 hover:bg-stone-50">
              <Upload className="w-4 h-4 mr-2" />Bulk Upload
            </Button>
          )}
          {currentUser?.role === 'ADMIN' && (
            <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
              onClick={() => setResetOpen(true)}>
              <AlertTriangle className="w-3.5 h-3.5 mr-2" />Reset All Data
            </Button>
          )}
          <Button onClick={() => { setCreateForm({ name: '', email: '', password: '', role: 'USER' }); setCreateOpen(true) }}
            className="bg-stone-900 hover:bg-stone-800">
            <Plus className="w-4 h-4 mr-2" />New User
          </Button>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs cursor-pointer select-none hover:bg-stone-100 transition-colors" onClick={() => handleSort('name')}>Name<SortIcon field="name" sortField={sortField} sortDir={sortDir} /></TableHead>
                <TableHead className="text-xs cursor-pointer select-none hover:bg-stone-100 transition-colors" onClick={() => handleSort('email')}>Email<SortIcon field="email" sortField={sortField} sortDir={sortDir} /></TableHead>
                <TableHead className="text-xs cursor-pointer select-none hover:bg-stone-100 transition-colors" onClick={() => handleSort('role')}>Role<SortIcon field="role" sortField={sortField} sortDir={sortDir} /></TableHead>
                <TableHead className="text-xs cursor-pointer select-none hover:bg-stone-100 transition-colors" onClick={() => handleSort('isActive')}>Status<SortIcon field="isActive" sortField={sortField} sortDir={sortDir} /></TableHead>
                <TableHead className="text-xs cursor-pointer select-none hover:bg-stone-100 transition-colors" onClick={() => handleSort('createdAt')}>Created<SortIcon field="createdAt" sortField={sortField} sortDir={sortDir} /></TableHead>
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
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-stone-400 text-sm">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell className="text-xs font-medium">{u.name}</TableCell>
                    <TableCell className="text-xs">{u.email}</TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${roleColors[u.role] || ''}`}>{u.role.replace(/_/g, ' ')}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${u.isActive ? 'bg-green-100 text-green-800' : 'bg-stone-100 text-stone-500'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(u)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {u.id !== currentUser?.id && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-stone-500 hover:text-red-600"
                            onClick={() => { setSelected(u); setDeleteOpen(true) }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
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
              Bulk Upload Users
            </DialogTitle>
            <DialogDescription>Upload an xlsx, xls, or csv file with user data. Max 500 rows.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800">Passwords in the file will be <span className="font-medium">automatically hashed</span> before storage. Do not pre-hash passwords in the spreadsheet.</p>
            </div>
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
                    <p className="text-sm font-medium text-green-800">{bulkResult.created} users created successfully</p>
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
          <DialogHeader><DialogTitle>Create User</DialogTitle><DialogDescription>Add a new system user</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input className="h-9 text-sm" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="Full name" />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" className="h-9 text-sm" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} placeholder="user@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <Input type="password" className="h-9 text-sm" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} placeholder="Password" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={createForm.role} onValueChange={(v) => setCreateForm({ ...createForm, role: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (<SelectItem key={r} value={r}>{r.replace(/_/g, ' ')}</SelectItem>))}
                </SelectContent>
              </Select>
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
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input className="h-9 text-sm" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (<SelectItem key={r} value={r}>{r.replace(/_/g, ' ')}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={editForm.isActive} onCheckedChange={(c) => setEditForm({ ...editForm, isActive: !!c })} />
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

      {/* Reset All Data Dialog */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Reset All Data
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="font-medium text-red-600">This will permanently delete ALL data from the system, including:</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>All expenses, advances, and requisitions</li>
                <li>All employees, salaries, attendance, and leave records</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-2">User accounts will be preserved — no need to create a new login. Everyone will just need to log in again.</p>
              <p>This action cannot be undone. Are you sure?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              setResetLoading(true)
              try {
                const res = await fetch('/api/reset-data', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true }) })
                const data = await res.json()
                if (res.ok) {
                  toast({ title: 'Data Reset Complete', description: `Deleted ${data.totalDeleted} records across ${Object.keys(data.details).length} tables.` })
                  setResetOpen(false)
                  // Redirect to login since sessions are cleared
                  setTimeout(() => window.location.href = '/', 1500)
                } else {
                  toast({ title: 'Error', description: data.error || 'Failed to reset data', variant: 'destructive' })
                }
              } catch {
                toast({ title: 'Error', description: 'Failed to reset data', variant: 'destructive' })
              } finally { setResetLoading(false) }
            }} disabled={resetLoading} className="bg-destructive hover:bg-destructive/90">
              {resetLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Yes, Delete Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selected?.name}? This action cannot be undone.
            </AlertDialogDescription>
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
