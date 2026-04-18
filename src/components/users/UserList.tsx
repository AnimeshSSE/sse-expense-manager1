'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore, type User, type UserRole } from '@/lib/store'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Upload, Edit, Trash2 } from 'lucide-react'
import { BulkUploadDialog } from './BulkUploadDialog'
import { UserForm } from './UserForm'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { toast } from 'sonner'
import { authGet, authDelete } from '@/lib/fetch'

const roleConfig: Record<UserRole, { label: string; className: string }> = {
  ADMIN: { label: 'Admin', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200' },
  MANAGER: { label: 'Manager', className: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border-teal-200' },
  STOCK_MANAGER: { label: 'Stock Manager', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200' },
  EMPLOYEE: { label: 'Employee', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200' },
}

export function UserList() {
  const { currentUser } = useAppStore()
  const queryClient = useQueryClient()
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [showUserForm, setShowUserForm] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery<{ users: User[]; total: number; totalPages: number }>({
    queryKey: ['users', roleFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (roleFilter !== 'ALL') params.set('role', roleFilter)
      params.set('limit', '50')
      return authGet(`/api/users?${params}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => authDelete(`/api/users?id=${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User deleted successfully')
      setDeleteId(null)
    },
    onError: () => toast.error('Failed to delete user'),
  })

  const users: User[] = data?.users || []
  const isAdmin = currentUser?.role === 'ADMIN'
  const canManage = currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER' || currentUser?.role === 'STOCK_MANAGER'

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
            {item.name.split(' ').map(n => n[0]).join('')}
          </div>
          <span className="font-medium text-sm">{item.name}</span>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (item) => (
        <span className="text-sm text-muted-foreground">{item.email}</span>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (item) => {
        const config = roleConfig[item.role as UserRole] || roleConfig.EMPLOYEE
        return (
          <Badge variant="outline" className={config.className}>
            {config.label}
          </Badge>
        )
      },
    },
    {
      key: 'department',
      header: 'Department',
      render: (item) => (
        <span className="text-sm">{item.department || '-'}</span>
      ),
    },
    {
      key: 'employeeId',
      header: 'Employee ID',
      render: (item) => (
        <span className="text-sm font-mono text-muted-foreground">{item.employeeId || '-'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => (
        <Badge variant={item.status === 'ACTIVE' ? 'default' : 'secondary'} className={
          item.status === 'ACTIVE'
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0'
            : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border-0'
        }>
          {item.status}
        </Badge>
      ),
    },
  ]

  const handleAddUser = () => {
    setEditingUser(null)
    setShowUserForm(true)
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setShowUserForm(true)
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
        <p className="text-muted-foreground">Failed to load users.</p>
        <button onClick={() => queryClient.invalidateQueries({ queryKey: ['users'] })} className="text-primary hover:underline">Retry</button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Manage users and their roles</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => setShowBulkUpload(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              Bulk Upload
            </Button>
          )}
          {canManage && (
            <Button onClick={handleAddUser} className="gap-2">
              <Plus className="h-4 w-4" />
              Add User
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Roles</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
            <SelectItem value="MANAGER">Manager</SelectItem>
            <SelectItem value="STOCK_MANAGER">Stock Manager</SelectItem>
            <SelectItem value="EMPLOYEE">Employee</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable<User>
        tableName="users"
        columns={columns}
        data={users }
        searchPlaceholder="Search users..."
        actions={(item) => (
          canManage ? (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => { e.stopPropagation(); handleEditUser(item) }}
              >
                <Edit className="h-4 w-4" />
              </Button>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); setDeleteId(item.id) }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ) : null
        )}
      />

      {isAdmin && (
        <BulkUploadDialog open={showBulkUpload} onOpenChange={setShowBulkUpload} />
      )}
      {canManage && (
        <UserForm
          open={showUserForm}
          onOpenChange={setShowUserForm}
          user={editingUser}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Delete User"
        description="Are you sure you want to delete this user? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}
