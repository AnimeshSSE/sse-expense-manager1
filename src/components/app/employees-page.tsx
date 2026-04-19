'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useLanguage } from '@/hooks/use-language'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  UserCircle,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Search,
  ShieldAlert,
  Phone,
  MapPin,
  Building2,
  IndianRupee,
  Calendar,
  Hash,
} from 'lucide-react'

// ==================== Types ====================

interface EmployeeItem {
  id: string
  userId: string
  employeeCode: string
  designation: string
  department: string | null
  phone: string | null
  address: string | null
  joiningDate: string
  baseSalary: number
  bankAccount: string | null
  bankName: string | null
  bankIfsc: string | null
  panNumber: string | null
  aadhaarNumber: string | null
  isActive: boolean
  createdAt: string
  user: { id: string; name: string; email: string; role: string; isActive: boolean }
}

interface LeaveItem {
  id: string
  employeeId: string
  type: string
  startDate: string
  endDate: string
  totalDays: number
  reason: string | null
  status: string
  approvedById: string | null
  approvedAt: string | null
  rejectionReason: string | null
  createdAt: string
  employee: {
    id: string
    employeeCode: string
    user: { id: string; name: string; email: string }
  }
  approvedBy: { id: string; name: string } | null
}

interface UserOption {
  id: string
  name: string
  email: string
}

// ==================== Badges ====================

function LeaveTypeBadge({ type }: { type: string }) {
  const config: Record<string, { className: string }> = {
    CASUAL: { className: 'bg-blue-100 text-blue-800 border-blue-200' },
    SICK: { className: 'bg-red-100 text-red-800 border-red-200' },
    EARNED: { className: 'bg-green-100 text-green-800 border-green-200' },
    HALF_DAY: { className: 'bg-amber-100 text-amber-800 border-amber-200' },
  }
  const c = config[type] || { className: 'bg-gray-100 text-gray-800' }
  return <Badge variant="outline" className={c.className}>{type.replace('_', ' ')}</Badge>
}

function LeaveStatusBadge({ status }: { status: string }) {
  const config: Record<string, { className: string }> = {
    PENDING: { className: 'bg-amber-100 text-amber-800 border-amber-200' },
    APPROVED: { className: 'bg-green-100 text-green-800 border-green-200' },
    REJECTED: { className: 'bg-red-100 text-red-800 border-red-200' },
    CANCELLED: { className: 'bg-gray-100 text-gray-500 border-gray-200' },
  }
  const c = config[status] || { className: 'bg-gray-100 text-gray-800' }
  return <Badge variant="outline" className={c.className}>{status}</Badge>
}

// ==================== Leave Sub-table (for employees tab) ====================

function EmployeeLeaves({ employeeId }: { employeeId: string }) {
  const { t } = useLanguage()
  const { data } = useQuery<{ leaves: LeaveItem[] }>({
    queryKey: ['leaves', 'employee', employeeId],
    queryFn: () => api.getLeaves({ employeeId, pageSize: '50' }) as Promise<{ leaves: LeaveItem[] }>,
  })
  const leaves = data?.leaves || []

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-navy-100 bg-navy-50/50">
            <TableHead className="text-navy-700 text-xs">Type</TableHead>
            <TableHead className="text-navy-700 text-xs">From</TableHead>
            <TableHead className="text-navy-700 text-xs">To</TableHead>
            <TableHead className="text-navy-700 text-xs">Days</TableHead>
            <TableHead className="text-navy-700 text-xs">{t.status}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leaves.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-6 text-navy-400 text-sm">
                No leaves found
              </TableCell>
            </TableRow>
          ) : (
            leaves.map((leave) => (
              <TableRow key={leave.id} className="border-navy-50">
                <TableCell><LeaveTypeBadge type={leave.type} /></TableCell>
                <TableCell className="text-sm text-navy-600">
                  {new Date(leave.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </TableCell>
                <TableCell className="text-sm text-navy-600">
                  {new Date(leave.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </TableCell>
                <TableCell className="text-sm font-medium text-navy-900">{leave.totalDays}</TableCell>
                <TableCell><LeaveStatusBadge status={leave.status} /></TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

// ==================== Main Component ====================

export function EmployeesPage() {
  const { user: currentUser } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const isAdmin = currentUser?.role === 'ADMIN'

  // State
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [activeTab, setActiveTab] = useState('employees')

  // Dialog state
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeItem | null>(null)
  const [editingEmployee, setEditingEmployee] = useState<EmployeeItem | null>(null)
  const [viewLeavesForId, setViewLeavesForId] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    userId: '',
    employeeCode: '',
    designation: '',
    department: '',
    phone: '',
    address: '',
    joiningDate: new Date().toISOString().split('T')[0],
    baseSalary: '',
    bankAccount: '',
    bankName: '',
    bankIfsc: '',
    panNumber: '',
    aadhaarNumber: '',
    isActive: true,
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Fetch employees
  const { data, isLoading } = useQuery<{ employees: EmployeeItem[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>({
    queryKey: ['employees', search, page],
    queryFn: () => {
      const params: Record<string, string> = { page: String(page), pageSize: '20' }
      if (search) params.search = search
      return api.getEmployees(params) as Promise<{ employees: EmployeeItem[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>
    },
  })

  // Fetch users for linking
  const { data: usersData } = useQuery<{ users: UserOption[] }>({
    queryKey: ['users-linkable'],
    queryFn: () => api.getUsers() as Promise<{ users: UserOption[] }>,
    enabled: isAdmin,
  })

  const unlinkedUsers = useMemo(() => {
    const linkedUserIds = new Set(data?.employees?.map((e) => e.userId) || [])
    return (usersData?.users || []).filter((u) => !linkedUserIds.has(u.id))
  }, [usersData, data])

  const employees = data?.employees || []
  const pagination = data?.pagination

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (d: typeof formData) => api.createEmployee(d),
    onSuccess: () => {
      toast.success(t.success)
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      setShowAddDialog(false)
      resetForm()
    },
    onError: (err: Error) => toast.error(err.message || t.error),
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof formData }) => api.updateEmployee(id, data),
    onSuccess: () => {
      toast.success(t.success)
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      setShowAddDialog(false)
      setEditingEmployee(null)
      resetForm()
    },
    onError: (err: Error) => toast.error(err.message || t.error),
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteEmployee(id),
    onSuccess: () => {
      toast.success(t.success)
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['leaves'] })
      setShowDeleteDialog(false)
      setSelectedEmployee(null)
    },
    onError: (err: Error) => toast.error(err.message || t.error),
  })

  function resetForm() {
    setFormData({
      userId: '',
      employeeCode: '',
      designation: '',
      department: '',
      phone: '',
      address: '',
      joiningDate: new Date().toISOString().split('T')[0],
      baseSalary: '',
      bankAccount: '',
      bankName: '',
      bankIfsc: '',
      panNumber: '',
      aadhaarNumber: '',
      isActive: true,
    })
    setFormErrors({})
  }

  function validateForm(isEdit: boolean) {
    const errors: Record<string, string> = {}
    if (!isEdit && !formData.userId) errors.userId = 'User is required'
    if (!formData.employeeCode.trim()) errors.employeeCode = 'Employee code is required'
    if (!formData.designation.trim()) errors.designation = 'Designation is required'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  function handleOpenCreate() {
    resetForm()
    setEditingEmployee(null)
    setShowAddDialog(true)
  }

  function handleOpenEdit(emp: EmployeeItem) {
    setEditingEmployee(emp)
    setFormData({
      userId: emp.userId,
      employeeCode: emp.employeeCode,
      designation: emp.designation,
      department: emp.department || '',
      phone: emp.phone || '',
      address: emp.address || '',
      joiningDate: emp.joiningDate.split('T')[0],
      baseSalary: String(emp.baseSalary),
      bankAccount: emp.bankAccount || '',
      bankName: emp.bankName || '',
      bankIfsc: emp.bankIfsc || '',
      panNumber: emp.panNumber || '',
      aadhaarNumber: emp.aadhaarNumber || '',
      isActive: emp.isActive,
    })
    setFormErrors({})
    setShowAddDialog(true)
  }

  function handleSubmit() {
    const isEdit = !!editingEmployee
    if (!validateForm(isEdit)) return

    const payload: Record<string, unknown> = {
      employeeCode: formData.employeeCode.trim(),
      designation: formData.designation.trim(),
      department: formData.department.trim() || null,
      phone: formData.phone.trim() || null,
      address: formData.address.trim() || null,
      joiningDate: formData.joiningDate,
      baseSalary: parseFloat(formData.baseSalary) || 0,
      bankAccount: formData.bankAccount.trim() || null,
      bankName: formData.bankName.trim() || null,
      bankIfsc: formData.bankIfsc.trim() || null,
      panNumber: formData.panNumber.trim() || null,
      aadhaarNumber: formData.aadhaarNumber.trim() || null,
      isActive: formData.isActive,
    }
    if (!isEdit) payload.userId = formData.userId

    if (isEdit) {
      updateMutation.mutate({ id: editingEmployee.id, data: payload as typeof formData })
    } else {
      createMutation.mutate(payload as typeof formData)
    }
  }

  // USER view: own profile only
  if (!isAdmin) {
    return <EmployeeProfileView />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <UserCircle className="w-7 h-7 text-amber-500" />
            {t.employees}
          </h2>
          <p className="text-sm text-navy-500 mt-1">
            Manage employee records and profiles
          </p>
        </div>
        <Button
          className="bg-amber-500 hover:bg-amber-600 text-white"
          onClick={handleOpenCreate}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Employee
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-navy-100">
          <TabsTrigger value="employees" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white">
            {t.employees}
          </TabsTrigger>
          <TabsTrigger value="leaves" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white">
            {t.leaves}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="space-y-4 mt-4">
          {/* Search */}
          <Card className="rounded-xl border-navy-100 bg-white p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
              <Input
                placeholder="Search by code, name, designation..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9 border-navy-200 focus:border-amber-400 focus:ring-amber-400/20"
              />
            </div>
          </Card>

          {/* Employees Table */}
          <Card className="rounded-xl border-navy-100 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-navy-100 bg-navy-50/50">
                    <TableHead className="text-navy-700 font-semibold">Code</TableHead>
                    <TableHead className="text-navy-700 font-semibold">Name</TableHead>
                    <TableHead className="text-navy-700 font-semibold">Designation</TableHead>
                    <TableHead className="text-navy-700 font-semibold">Department</TableHead>
                    <TableHead className="text-navy-700 font-semibold">Phone</TableHead>
                    <TableHead className="text-navy-700 font-semibold">{t.status}</TableHead>
                    <TableHead className="text-navy-700 font-semibold text-right">{t.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="border-navy-50">
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : employees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-navy-400">
                        {t.noData}
                      </TableCell>
                    </TableRow>
                  ) : (
                    employees.map((emp) => (
                      <TableRow
                        key={emp.id}
                        className="border-navy-50 hover:bg-amber-50/30 transition-colors"
                      >
                        <TableCell className="text-sm font-mono font-medium text-amber-700">{emp.employeeCode}</TableCell>
                        <TableCell className="text-sm font-medium text-navy-900">{emp.user.name}</TableCell>
                        <TableCell className="text-sm text-navy-600">{emp.designation}</TableCell>
                        <TableCell className="text-sm text-navy-600">{emp.department || '—'}</TableCell>
                        <TableCell className="text-sm text-navy-600">{emp.phone || '—'}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={emp.isActive ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}
                          >
                            {emp.isActive ? t.active : t.inactive}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => { setSelectedEmployee(emp); setShowViewDialog(true) }}>
                                <Eye className="w-4 h-4 mr-2" /> View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenEdit(emp)}>
                                <Pencil className="w-4 h-4 mr-2" /> {t.edit}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => { setSelectedEmployee(emp); setShowDeleteDialog(true) }}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> {t.delete}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-navy-100">
                <p className="text-sm text-navy-500">
                  {(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
                </p>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                    ‹
                  </Button>
                  <Button variant={page === 1 ? 'default' : 'outline'} size="icon" className={`h-8 w-8 ${page === 1 ? 'bg-amber-500 text-white' : ''}`} onClick={() => setPage(1)}>1</Button>
                  {pagination.totalPages > 1 && <Button variant={page === 2 ? 'default' : 'outline'} size="icon" className={`h-8 w-8 ${page === 2 ? 'bg-amber-500 text-white' : ''}`} onClick={() => setPage(2)}>2</Button>}
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages}>
                    ›
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="leaves" className="space-y-4 mt-4">
          {/* All leaves table - simplified version for admin view within employees */}
          <AllLeavesInline />
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) { setEditingEmployee(null); resetForm() } }}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-navy-900">
              {editingEmployee ? t.edit : 'Add Employee'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* User Link */}
            {!editingEmployee && (
              <div className="grid gap-2">
                <Label className="text-navy-700">Link User (by email) *</Label>
                <Select value={formData.userId} onValueChange={(v) => setFormData((f) => ({ ...f, userId: v }))}>
                  <SelectTrigger className="border-navy-200">
                    <SelectValue placeholder="Select user to link" />
                  </SelectTrigger>
                  <SelectContent>
                    {unlinkedUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} — {u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.userId && <p className="text-xs text-red-500">{formErrors.userId}</p>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-navy-700">Employee Code *</Label>
                <Input
                  placeholder="EMP-001"
                  value={formData.employeeCode}
                  onChange={(e) => setFormData((f) => ({ ...f, employeeCode: e.target.value }))}
                  className="border-navy-200 focus:border-amber-400 focus:ring-amber-400/20"
                />
                {formErrors.employeeCode && <p className="text-xs text-red-500">{formErrors.employeeCode}</p>}
              </div>
              <div className="grid gap-2">
                <Label className="text-navy-700">Designation *</Label>
                <Input
                  placeholder="Electrician"
                  value={formData.designation}
                  onChange={(e) => setFormData((f) => ({ ...f, designation: e.target.value }))}
                  className="border-navy-200 focus:border-amber-400 focus:ring-amber-400/20"
                />
                {formErrors.designation && <p className="text-xs text-red-500">{formErrors.designation}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-navy-700">Department</Label>
                <Input
                  placeholder="Electrical"
                  value={formData.department}
                  onChange={(e) => setFormData((f) => ({ ...f, department: e.target.value }))}
                  className="border-navy-200 focus:border-amber-400 focus:ring-amber-400/20"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-navy-700">Phone</Label>
                <Input
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => setFormData((f) => ({ ...f, phone: e.target.value }))}
                  className="border-navy-200 focus:border-amber-400 focus:ring-amber-400/20"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-navy-700">Address</Label>
              <Input
                placeholder="Full address"
                value={formData.address}
                onChange={(e) => setFormData((f) => ({ ...f, address: e.target.value }))}
                className="border-navy-200 focus:border-amber-400 focus:ring-amber-400/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-navy-700">Joining Date</Label>
                <Input
                  type="date"
                  value={formData.joiningDate}
                  onChange={(e) => setFormData((f) => ({ ...f, joiningDate: e.target.value }))}
                  className="border-navy-200 focus:border-amber-400 focus:ring-amber-400/20"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-navy-700">Base Salary (₹)</Label>
                <Input
                  type="number"
                  placeholder="25000"
                  value={formData.baseSalary}
                  onChange={(e) => setFormData((f) => ({ ...f, baseSalary: e.target.value }))}
                  className="border-navy-200 focus:border-amber-400 focus:ring-amber-400/20"
                />
              </div>
            </div>

            {/* Bank Details Section */}
            <div className="border-t border-navy-100 pt-4">
              <p className="text-sm font-semibold text-navy-700 mb-3">Bank Details</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-navy-700">Bank Name</Label>
                  <Input
                    placeholder="SBI"
                    value={formData.bankName}
                    onChange={(e) => setFormData((f) => ({ ...f, bankName: e.target.value }))}
                    className="border-navy-200 focus:border-amber-400 focus:ring-amber-400/20"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-navy-700">Account Number</Label>
                  <Input
                    placeholder="1234567890"
                    value={formData.bankAccount}
                    onChange={(e) => setFormData((f) => ({ ...f, bankAccount: e.target.value }))}
                    className="border-navy-200 focus:border-amber-400 focus:ring-amber-400/20"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-navy-700">IFSC Code</Label>
                  <Input
                    placeholder="SBIN0001234"
                    value={formData.bankIfsc}
                    onChange={(e) => setFormData((f) => ({ ...f, bankIfsc: e.target.value }))}
                    className="border-navy-200 focus:border-amber-400 focus:ring-amber-400/20"
                  />
                </div>
              </div>
            </div>

            {/* Identity Section */}
            <div className="border-t border-navy-100 pt-4">
              <p className="text-sm font-semibold text-navy-700 mb-3">Identity Documents</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-navy-700">PAN Number</Label>
                  <Input
                    placeholder="ABCDE1234F"
                    value={formData.panNumber}
                    onChange={(e) => setFormData((f) => ({ ...f, panNumber: e.target.value }))}
                    className="border-navy-200 focus:border-amber-400 focus:ring-amber-400/20"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-navy-700">Aadhaar Number</Label>
                  <Input
                    placeholder="1234 5678 9012"
                    value={formData.aadhaarNumber}
                    onChange={(e) => setFormData((f) => ({ ...f, aadhaarNumber: e.target.value }))}
                    className="border-navy-200 focus:border-amber-400 focus:ring-amber-400/20"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setShowAddDialog(false); setEditingEmployee(null); resetForm() }} className="border-navy-200">
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
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          {selectedEmployee && (
            <>
              <DialogHeader>
                <DialogTitle className="text-navy-900 flex items-center gap-2">
                  Employee Details
                  <Badge variant="outline" className={selectedEmployee.isActive ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}>
                    {selectedEmployee.isActive ? t.active : t.inactive}
                  </Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {/* Profile header */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-navy-900 text-white flex items-center justify-center text-lg font-bold">
                    {selectedEmployee.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-navy-900">{selectedEmployee.user.name}</p>
                    <p className="text-sm text-navy-500">{selectedEmployee.user.email}</p>
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-2">
                    <Hash className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-navy-500 uppercase tracking-wide">Code</p>
                      <p className="text-sm font-mono font-medium text-navy-900">{selectedEmployee.employeeCode}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Building2 className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-navy-500 uppercase tracking-wide">Designation</p>
                      <p className="text-sm text-navy-800">{selectedEmployee.designation}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Building2 className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-navy-500 uppercase tracking-wide">Department</p>
                      <p className="text-sm text-navy-800">{selectedEmployee.department || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Phone className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-navy-500 uppercase tracking-wide">Phone</p>
                      <p className="text-sm text-navy-800">{selectedEmployee.phone || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-navy-500 uppercase tracking-wide">Address</p>
                      <p className="text-sm text-navy-800">{selectedEmployee.address || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-navy-500 uppercase tracking-wide">Joining Date</p>
                      <p className="text-sm text-navy-800">
                        {new Date(selectedEmployee.joiningDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <IndianRupee className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-navy-500 uppercase tracking-wide">Base Salary</p>
                      <p className="text-sm font-semibold text-navy-900">₹{selectedEmployee.baseSalary.toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                </div>

                {/* Bank details */}
                {selectedEmployee.bankName && (
                  <div className="border-t border-navy-100 pt-4">
                    <p className="text-xs text-navy-500 uppercase tracking-wide font-semibold mb-2">Bank Details</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-navy-500">Bank:</span> <span className="text-navy-800">{selectedEmployee.bankName}</span></div>
                      <div><span className="text-navy-500">Account:</span> <span className="text-navy-800">{selectedEmployee.bankAccount}</span></div>
                      <div><span className="text-navy-500">IFSC:</span> <span className="text-navy-800">{selectedEmployee.bankIfsc}</span></div>
                    </div>
                  </div>
                )}

                {/* Identity */}
                {(selectedEmployee.panNumber || selectedEmployee.aadhaarNumber) && (
                  <div className="border-t border-navy-100 pt-4">
                    <p className="text-xs text-navy-500 uppercase tracking-wide font-semibold mb-2">Identity</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {selectedEmployee.panNumber && <div><span className="text-navy-500">PAN:</span> <span className="text-navy-800">{selectedEmployee.panNumber}</span></div>}
                      {selectedEmployee.aadhaarNumber && <div><span className="text-navy-500">Aadhaar:</span> <span className="text-navy-800">{selectedEmployee.aadhaarNumber}</span></div>}
                    </div>
                  </div>
                )}

                {/* Leaves section */}
                <div className="border-t border-navy-100 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-navy-500 uppercase tracking-wide font-semibold">Leave History</p>
                    {viewLeavesForId !== selectedEmployee.id && (
                      <Button variant="outline" size="sm" className="border-navy-200 text-xs" onClick={() => setViewLeavesForId(selectedEmployee.id)}>
                        Show Leaves
                      </Button>
                    )}
                  </div>
                  {viewLeavesForId === selectedEmployee.id && (
                    <EmployeeLeaves employeeId={selectedEmployee.id} />
                  )}
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
              Delete Employee
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selectedEmployee?.user.name}</strong> ({selectedEmployee?.employeeCode})?
              This will also delete all their leave records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-navy-200">{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => selectedEmployee && deleteMutation.mutate(selectedEmployee.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ==================== USER profile view ====================

function EmployeeProfileView() {
  const { user: currentUser } = useAuth()
  const { t } = useLanguage()

  const { data, isLoading } = useQuery<{ employees: EmployeeItem[] }>({
    queryKey: ['employees', 'my-profile'],
    queryFn: () => api.getEmployees() as Promise<{ employees: EmployeeItem[] }>,
  })

  const employee = data?.employees?.[0] || null

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-14 h-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <Card className="rounded-xl border-navy-100 bg-white p-6">
          <Skeleton className="h-48 w-full" />
        </Card>
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
          <UserCircle className="w-7 h-7 text-amber-500" />
          My Profile
        </h2>
        <Card className="rounded-xl border-navy-100 bg-white p-12 text-center">
          <UserCircle className="w-16 h-16 text-navy-300 mx-auto mb-4" />
          <p className="text-navy-600 font-medium">No employee profile found</p>
          <p className="text-sm text-navy-400 mt-1">Contact your administrator to set up your employee profile.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
        <UserCircle className="w-7 h-7 text-amber-500" />
        My Profile
      </h2>

      {/* Profile Card */}
      <Card className="rounded-xl border-navy-100 bg-white p-6">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="w-16 h-16 rounded-full bg-navy-900 text-white flex items-center justify-center text-2xl font-bold shrink-0">
            {currentUser?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-navy-500 uppercase tracking-wide">{t.employee} Code</p>
              <p className="text-lg font-mono font-medium text-amber-700">{employee.employeeCode}</p>
            </div>
            <div>
              <p className="text-xs text-navy-500 uppercase tracking-wide">Designation</p>
              <p className="text-lg font-semibold text-navy-900">{employee.designation}</p>
            </div>
            <div>
              <p className="text-xs text-navy-500 uppercase tracking-wide">Department</p>
              <p className="text-sm text-navy-800">{employee.department || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-navy-500 uppercase tracking-wide">{t.date} Joined</p>
              <p className="text-sm text-navy-800">
                {new Date(employee.joiningDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div>
              <p className="text-xs text-navy-500 uppercase tracking-wide">Phone</p>
              <p className="text-sm text-navy-800">{employee.phone || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-navy-500 uppercase tracking-wide">{t.email}</p>
              <p className="text-sm text-navy-800">{currentUser?.email}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* My Leaves */}
      <Card className="rounded-xl border-navy-100 bg-white p-4">
        <h3 className="text-lg font-semibold text-navy-900 mb-4">My {t.leaves}</h3>
        <EmployeeLeaves employeeId={employee.id} />
      </Card>
    </div>
  )
}

// ==================== Inline leaves for admin tab ====================

function AllLeavesInline() {
  const { t } = useLanguage()
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<{ leaves: LeaveItem[]; pagination: { total: number; totalPages: number } }>({
    queryKey: ['leaves', 'admin-tab', statusFilter, page],
    queryFn: () => {
      const params: Record<string, string> = { page: String(page), pageSize: '10' }
      if (statusFilter !== 'ALL') params.status = statusFilter
      return api.getLeaves(params) as Promise<{ leaves: LeaveItem[]; pagination: { total: number; totalPages: number } }>
    },
  })

  const leaves = data?.leaves || []
  const pag = data?.pagination

  return (
    <Card className="rounded-xl border-navy-100 bg-white overflow-hidden">
      <div className="p-4 border-b border-navy-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-lg font-semibold text-navy-900">All {t.leaves}</h3>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
            <SelectTrigger className="w-[160px] border-navy-200">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="PENDING">{t.pending}</SelectItem>
              <SelectItem value="APPROVED">{t.approved}</SelectItem>
              <SelectItem value="REJECTED">{t.rejected}</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-navy-100 bg-navy-50/50">
              <TableHead className="text-navy-700 text-xs">{t.employee}</TableHead>
              <TableHead className="text-navy-700 text-xs">Type</TableHead>
              <TableHead className="text-navy-700 text-xs">From</TableHead>
              <TableHead className="text-navy-700 text-xs">To</TableHead>
              <TableHead className="text-navy-700 text-xs">Days</TableHead>
              <TableHead className="text-navy-700 text-xs">{t.status}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-navy-50">
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                </TableRow>
              ))
            ) : leaves.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-navy-400 text-sm">{t.noData}</TableCell>
              </TableRow>
            ) : (
              leaves.map((leave) => (
                <TableRow key={leave.id} className="border-navy-50 hover:bg-amber-50/30">
                  <TableCell className="text-sm font-medium text-navy-900">{leave.employee.user.name}</TableCell>
                  <TableCell><LeaveTypeBadge type={leave.type} /></TableCell>
                  <TableCell className="text-sm text-navy-600">
                    {new Date(leave.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </TableCell>
                  <TableCell className="text-sm text-navy-600">
                    {new Date(leave.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </TableCell>
                  <TableCell className="text-sm font-medium text-navy-900">{leave.totalDays}</TableCell>
                  <TableCell><LeaveStatusBadge status={leave.status} /></TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {pag && pag.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-navy-100">
          <p className="text-sm text-navy-500">{pag.total} total</p>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>‹</Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.min(pag.totalPages, p + 1))} disabled={page >= pag.totalPages}>›</Button>
          </div>
        </div>
      )}
    </Card>
  )
}
