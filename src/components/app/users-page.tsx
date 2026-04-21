'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useLanguage } from '@/hooks/use-language'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  Plus,
  Users as UsersIcon,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react'

// ==================== Types ====================

interface UserItem {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  lastLogin: string | null
  createdAt: string
  employee: { id: string; employeeCode: string } | null
}

// ==================== Role Badge ====================

function RoleBadge({ role }: { role: string }) {
  const config: Record<string, { className: string }> = {
    ADMIN: { className: 'bg-red-100 text-red-800 border-red-200' },
    ACCOUNTANT: { className: 'bg-blue-100 text-blue-800 border-blue-200' },
    STOCK_MANAGER: { className: 'bg-purple-100 text-purple-800 border-purple-200' },
    USER: { className: 'bg-gray-100 text-gray-800 border-gray-200' },
  }
  const c = config[role] || { className: 'bg-gray-100 text-gray-800' }
  return <Badge variant="outline" className={c.className}>{role}</Badge>
}

// ==================== Main Component ====================

export function UsersPage() {
  const { user: currentUser } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  // Dialog state
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null)
  const [editingUser, setEditingUser] = useState<UserItem | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'USER',
    password: '',
    isActive: true,
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Fetch users
  const { data, isLoading } = useQuery<{ users: UserItem[] }>({
    queryKey: ['users'],
    queryFn: () => api.getUsers() as Promise<{ users: UserItem[] }>,
  })

  const users = data?.users || []

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (d: typeof formData) => api.createUser(d),
    onSuccess: () => {
      toast.success(t.success)
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowAddDialog(false)
      resetForm()
    },
    onError: (err: Error) => toast.error(err.message || t.error),
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof formData }) => api.updateUser(id, data),
    onSuccess: () => {
      toast.success(t.success)
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowAddDialog(false)
      setEditingUser(null)
      resetForm()
    },
    onError: (err: Error) => toast.error(err.message || t.error),
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteUser(id),
    onSuccess: () => {
      toast.success(t.success)
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setShowDeleteDialog(false)
      setSelectedUser(null)
    },
    onError: (err: Error) => toast.error(err.message || t.error),
  })

  // Reset data mutation
  const resetMutation = useMutation({
    mutationFn: () => api.resetData(),
    onSuccess: () => {
      toast.success('All data reset successfully')
      queryClient.invalidateQueries()
      setShowResetDialog(false)
    },
    onError: (err: Error) => toast.error(err.message || t.error),
  })

  function resetForm() {
    setFormData({ name: '', email: '', role: 'USER', password: '', isActive: true })
    setFormErrors({})
  }

  function validateForm(isEdit: boolean) {
    const errors: Record<string, string> = {}
    if (!formData.name.trim()) errors.name = 'Name is required'
    if (!formData.email.trim()) errors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = 'Invalid email'
    if (!isEdit && !formData.password.trim()) errors.password = 'Password is required'
    if (!isEdit && formData.password.trim().length < 4) errors.password = 'Password must be at least 4 characters'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  function handleOpenCreate() {
    resetForm()
    setEditingUser(null)
    setShowAddDialog(true)
  }

  function handleOpenEdit(user: UserItem) {
    setEditingUser(user)
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      password: '',
      isActive: user.isActive,
    })
    setFormErrors({})
    setShowAddDialog(true)
  }

  function handleSubmit() {
    const isEdit = !!editingUser
    if (!validateForm(isEdit)) return

    const payload: Record<string, unknown> = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      role: formData.role,
      isActive: formData.isActive,
    }
    if (formData.password.trim()) payload.password = formData.password.trim()

    if (isEdit) {
      updateMutation.mutate({ id: editingUser.id, data: payload as any })
    } else {
      createMutation.mutate(payload as typeof formData)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <UsersIcon className="w-7 h-7 text-amber-500" />
            {t.users}
          </h2>
          <p className="text-sm text-navy-500 mt-1">
            Manage user accounts and permissions
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => setShowResetDialog(true)}
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            {t.resetData}
          </Button>
          <Button
            className="bg-amber-500 hover:bg-amber-600 text-white"
            onClick={handleOpenCreate}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add User
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="rounded-xl border-navy-100 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-navy-100 bg-navy-50/50">
                <TableHead className="text-navy-700 font-semibold">Name</TableHead>
                <TableHead className="text-navy-700 font-semibold">{t.email}</TableHead>
                <TableHead className="text-navy-700 font-semibold">{t.role}</TableHead>
                <TableHead className="text-navy-700 font-semibold">{t.status}</TableHead>
                <TableHead className="text-navy-700 font-semibold">Last Login</TableHead>
                <TableHead className="text-navy-700 font-semibold text-right">{t.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-navy-50">
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-navy-400">
                    {t.noData}
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow
                    key={u.id}
                    className="border-navy-50 hover:bg-amber-50/30 transition-colors"
                  >
                    <TableCell className="text-sm font-medium text-navy-900">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-navy-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span>{u.name}</span>
                          {u.employee && (
                            <p className="text-[10px] text-navy-400">{u.employee.employeeCode}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-navy-600">{u.email}</TableCell>
                    <TableCell><RoleBadge role={u.role} /></TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          u.isActive
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : 'bg-gray-100 text-gray-500 border-gray-200'
                        }
                      >
                        {u.isActive ? t.active : t.inactive}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-navy-500">
                      {formatDateTime(u.lastLogin)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => { setSelectedUser(u); setShowViewDialog(true) }}>
                            <Eye className="w-4 h-4 mr-2" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenEdit(u)}>
                            <Pencil className="w-4 h-4 mr-2" /> {t.edit}
                          </DropdownMenuItem>
                          {u.id !== currentUser?.id && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => { setSelectedUser(u); setShowDeleteDialog(true) }}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> {t.delete}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) { setEditingUser(null); resetForm() } }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-navy-900">
              {editingUser ? t.edit : 'Add User'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-navy-700">Name *</Label>
              <Input
                id="name"
                placeholder="Full name"
                value={formData.name}
                onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                className="border-navy-200 focus:border-amber-400 focus:ring-amber-400/20"
              />
              {formErrors.name && <p className="text-xs text-red-500">{formErrors.name}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="uemail" className="text-navy-700">{t.email} *</Label>
              <Input
                id="uemail"
                type="email"
                placeholder="user@company.com"
                value={formData.email}
                onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                className="border-navy-200 focus:border-amber-400 focus:ring-amber-400/20"
              />
              {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="urole" className="text-navy-700">{t.role} *</Label>
              <Select
                value={formData.role}
                onValueChange={(v) => setFormData((f) => ({ ...f, role: v }))}
              >
                <SelectTrigger id="urole" className="border-navy-200">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                  <SelectItem value="ACCOUNTANT">ACCOUNTANT</SelectItem>
                  <SelectItem value="STOCK_MANAGER">STOCK_MANAGER</SelectItem>
                  <SelectItem value="USER">USER</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="upassword" className="text-navy-700">
                {editingUser ? 'New Password (leave blank to keep)' : 'Password *'}
              </Label>
              <Input
                id="upassword"
                type="password"
                placeholder={editingUser ? 'Leave blank to keep current' : 'Minimum 4 characters'}
                value={formData.password}
                onChange={(e) => setFormData((f) => ({ ...f, password: e.target.value }))}
                className="border-navy-200 focus:border-amber-400 focus:ring-amber-400/20"
              />
              {formErrors.password && <p className="text-xs text-red-500">{formErrors.password}</p>}
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData((f) => ({ ...f, isActive: checked }))}
              />
              <Label className="text-navy-700">{t.active}</Label>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setShowAddDialog(false); setEditingUser(null); resetForm() }} className="border-navy-200">
              {t.cancel}
            </Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-[480px]">
          {selectedUser && (
            <>
              <DialogHeader>
                <DialogTitle className="text-navy-900 flex items-center gap-2">
                  User Details
                  <RoleBadge role={selectedUser.role} />
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-navy-900 text-white flex items-center justify-center text-lg font-bold">
                    {selectedUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-navy-900">{selectedUser.name}</p>
                    <p className="text-sm text-navy-500">{selectedUser.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide">{t.role}</p>
                    <RoleBadge role={selectedUser.role} />
                  </div>
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide">{t.status}</p>
                    <Badge
                      variant="outline"
                      className={
                        selectedUser.isActive
                          ? 'bg-green-100 text-green-800 border-green-200'
                          : 'bg-gray-100 text-gray-500 border-gray-200'
                      }
                    >
                      {selectedUser.isActive ? t.active : t.inactive}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide">Created</p>
                    <p className="text-sm text-navy-800">{formatDate(selectedUser.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide">Last Login</p>
                    <p className="text-sm text-navy-800">{formatDateTime(selectedUser.lastLogin)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide">Employee</p>
                    <p className="text-sm text-navy-800">
                      {selectedUser.employee ? selectedUser.employee.employeeCode : 'Not linked'}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-navy-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              Deactivate User
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate <strong>{selectedUser?.name}</strong> and clear their session.
              Their data will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-navy-200">{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => selectedUser && deleteMutation.mutate(selectedUser.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deactivating...' : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Data Confirmation */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-navy-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              {t.resetData}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently <strong>delete all data</strong> (expenses, advances, requisitions,
              leaves, employees, etc.) and reset the application to its initial state.
              The admin account will be recreated with the default password.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-navy-200">{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? 'Resetting...' : 'Reset Everything'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
