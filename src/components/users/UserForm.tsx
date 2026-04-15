'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { User, UserRole } from '@/lib/store'
import { departments } from '@/lib/store'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

interface UserFormInnerProps {
  user: User | null
  onClose: () => void
}

function UserFormInner({ user, onClose }: UserFormInnerProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [role, setRole] = useState<UserRole>((user?.role as UserRole) ?? 'EMPLOYEE')
  const [department, setDepartment] = useState(user?.department ?? '')
  const [employeeId, setEmployeeId] = useState(user?.employeeId ?? '')

  const isEdit = !!user

  const createMutation = useMutation({
    mutationFn: (body: object) => fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User created successfully')
      onClose()
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create user')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (body: object) => fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User updated successfully')
      onClose()
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update user')
    },
  })

  const handleSubmit = () => {
    if (!name.trim() || !email.trim()) {
      toast.error('Name and email are required')
      return
    }

    const body = { name, email, role, department, employeeId }

    if (isEdit && user?.id) {
      updateMutation.mutate({ ...body, id: user.id })
    } else {
      createMutation.mutate(body)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit User' : 'Add New User'}</DialogTitle>
        <DialogDescription>
          {isEdit ? 'Update user information' : 'Fill in the new user details'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="user-name">Full Name *</Label>
          <Input id="user-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="user-email">Email *</Label>
          <Input id="user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@sse.com" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="user-role">Role *</Label>
          <Select value={role} onValueChange={(val) => setRole(val as UserRole)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="MANAGER">Manager</SelectItem>
              <SelectItem value="STOCK_MANAGER">Stock Manager</SelectItem>
              <SelectItem value="EMPLOYEE">Employee</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="user-dept">Department *</Label>
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
            <SelectContent>
              {departments.map((dept) => (<SelectItem key={dept} value={dept}>{dept}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="user-empid">Employee ID *</Label>
          <Input id="user-empid" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="SSE-001" />
        </div>
      </div>

      <DialogFooter className="flex-col sm:flex-row gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {isEdit ? 'Save Changes' : 'Create User'}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

interface UserFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
}

export function UserForm({ open, onOpenChange, user }: UserFormProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <UserFormInner
          key={user?.id ?? 'new'}
          user={user}
          onClose={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  )
}
