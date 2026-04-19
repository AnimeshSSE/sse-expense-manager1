'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { useLanguage } from '@/hooks/use-language'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
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
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { format } from 'date-fns'
import {
  Plus, Pencil, Trash2, Loader2, Users, Eye, CheckCircle, XCircle,
  CalendarDays, Banknote, UserCog, Search,
} from 'lucide-react'

// ==================== Constants ====================

const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'HALF_DAY', 'HOLIDAY', 'WEEK_OFF', 'LEAVE'] as const
const LEAVE_TYPES = ['CASUAL', 'SICK', 'EARNED', 'HALF_DAY'] as const
const LEAVE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-stone-100 text-stone-500',
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-stone-100 text-stone-600',
  PAID: 'bg-emerald-100 text-emerald-800',
  UNPAID: 'bg-amber-100 text-amber-800',
  PRESENT: 'bg-green-100 text-green-800',
  ABSENT: 'bg-red-100 text-red-800',
  HALF_DAY: 'bg-amber-100 text-amber-800',
  HOLIDAY: 'bg-purple-100 text-purple-800',
  WEEK_OFF: 'bg-cyan-100 text-cyan-800',
  LEAVE: 'bg-orange-100 text-orange-800',
}

const attendanceLabelMap: Record<string, (t: (k: string) => string) => string> = {
  PRESENT: (t) => t('hr.present'),
  ABSENT: (t) => t('hr.absent'),
  HALF_DAY: (t) => t('hr.halfDay'),
  HOLIDAY: (t) => t('hr.holiday'),
  WEEK_OFF: (t) => t('hr.weekOff'),
  LEAVE: (t) => t('hr.leave'),
}

const leaveTypeLabelMap: Record<string, (t: (k: string) => string) => string> = {
  CASUAL: (t) => t('hr.casual'),
  SICK: (t) => t('hr.sick'),
  EARNED: (t) => t('hr.earned'),
  HALF_DAY: (t) => t('hr.halfDay'),
}

// ==================== Empty States ====================

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <TableRow>
      <TableCell colSpan={20} className="text-center py-12 text-stone-400 text-sm">
        <Icon className="w-8 h-8 mx-auto mb-2 opacity-30" />
        {message}
      </TableCell>
    </TableRow>
  )
}

// ==================== Skeleton Rows ====================

function SkeletonRows({ cols = 6, rows = 4 }: { cols?: number; rows?: number }) {
  return (
    <>
      {[...Array(rows)].map((_, i) => (
        <TableRow key={i}>
          {[...Array(cols)].map((_, j) => (
            <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

// ==================== Stat Card ====================

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color?: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color || 'bg-stone-100'}`}>
            <Icon className="w-4 h-4 text-stone-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold text-stone-900">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ==================== Sort Helpers ====================

function SortIcon({ field, sortField, sortDir }: { field: string; sortField: string; sortDir: string }) {
  if (sortField !== field) return <span className="ml-1 opacity-25 text-[9px] leading-none select-none">▲▼</span>
  return <span className="ml-1 text-foreground text-[9px] leading-none select-none">{sortDir === 'asc' ? '▲' : '▼'}</span>
}

function sortData<T>(items: T[], field: string, dir: string): T[] {
  return [...items].sort((a: any, b: any) => {
    let aVal = field.includes('.') ? field.split('.').reduce((o: any, k: string) => o?.[k], a) : a[field]
    let bVal = field.includes('.') ? field.split('.').reduce((o: any, k: string) => o?.[k], b) : b[field]
    if (aVal == null) aVal = ''
    if (bVal == null) bVal = ''
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return dir === 'asc' ? aVal - bVal : bVal - aVal
    }
    return dir === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal))
  })
}

function useSortState(defaultField: string = 'createdAt', defaultDir: string = 'desc') {
  const [sortField, setSortField] = useState(defaultField)
  const [sortDir, setSortDir] = useState(defaultDir)
  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }, [sortField])
  return { sortField, sortDir, handleSort }
}

// ==================== Employees Tab ====================

function EmployeesTab() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const isAdmin = user?.role === 'ADMIN'
  const canManageEmployees = isAdmin || user?.role === 'ACCOUNTANT'

  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [designationFilter, setDesignationFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [users, setUsers] = useState<any[]>([])
  const [createForm, setCreateForm] = useState({
    userId: '', designation: '', department: '', phone: '', baseSalary: '',
    bankAccount: '', bankName: '', bankIfsc: '', panNumber: '', aadhaarNumber: '',
  })
  const [editForm, setEditForm] = useState({
    designation: '', department: '', phone: '', baseSalary: '',
    bankAccount: '', bankName: '', bankIfsc: '', panNumber: '', aadhaarNumber: '',
  })

  const { sortField, sortDir, handleSort } = useSortState('createdAt', 'desc')
  const sortedEmployees = useMemo(() => sortData(employees, sortField, sortDir), [employees, sortField, sortDir])

  const loadEmployees = useCallback(async () => {
    setLoading(true)
    try {
      if (canManageEmployees) {
        const params: Record<string, string> = {}
        if (search) params.search = search
        if (designationFilter) params.designation = designationFilter
        if (departmentFilter) params.department = departmentFilter
        setEmployees(await api.getEmployees(params))
      } else {
        // Non-admin users can only see their own employee record
        const emps = await api.getEmployees({ userId: user?.id || '' })
        setEmployees(emps)
      }
    } catch { /* handled */ }
    finally { setLoading(false) }
  }, [search, designationFilter, departmentFilter, canManageEmployees, user?.id])

  const loadUsers = useCallback(async () => {
    try { setUsers(await api.getUsers()) } catch { /* handled */ }
  }, [])

  useEffect(() => { loadEmployees() }, [loadEmployees])
  useEffect(() => { if (canManageEmployees) loadUsers() }, [canManageEmployees, loadUsers])

  const handleCreate = async () => {
    if (!createForm.userId || !createForm.designation || !createForm.department || !createForm.baseSalary) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' })
      return
    }
    setActionLoading(true)
    try {
      await api.createEmployee({
        ...createForm,
        baseSalary: Number(createForm.baseSalary),
      })
      toast({ title: 'Success', description: 'Employee created successfully' })
      setCreateOpen(false)
      setCreateForm({ userId: '', designation: '', department: '', phone: '', baseSalary: '', bankAccount: '', bankName: '', bankIfsc: '', panNumber: '', aadhaarNumber: '' })
      loadEmployees()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const handleEdit = async () => {
    if (!editForm.designation || !editForm.department) {
      toast({ title: 'Error', description: 'Please fill in required fields', variant: 'destructive' })
      return
    }
    setActionLoading(true)
    try {
      await api.updateEmployee(selected.id, {
        ...editForm,
        baseSalary: Number(editForm.baseSalary),
      })
      toast({ title: 'Success', description: 'Employee updated successfully' })
      setEditOpen(false)
      loadEmployees()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const handleDelete = async () => {
    setActionLoading(true)
    try {
      await api.deleteEmployee(selected.id)
      toast({ title: 'Success', description: 'Employee deleted successfully' })
      setDeleteOpen(false)
      loadEmployees()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const openEdit = (emp: any) => {
    setSelected(emp)
    setEditForm({
      designation: emp.designation || '',
      department: emp.department || '',
      phone: emp.phone || '',
      baseSalary: String(emp.baseSalary || ''),
      bankAccount: emp.bankAccount || '',
      bankName: emp.bankName || '',
      bankIfsc: emp.bankIfsc || '',
      panNumber: emp.panNumber || '',
      aadhaarNumber: emp.aadhaarNumber || '',
    })
    setEditOpen(true)
  }

  // Extract unique designations and departments
  const designations = [...new Set(employees.map((e: any) => e.designation).filter(Boolean))]
  const departments = [...new Set(employees.map((e: any) => e.department).filter(Boolean))]

  // Stats
  const activeEmployees = employees.filter((e: any) => e.status === 'ACTIVE').length
  const thisMonth = new Date().toISOString().slice(0, 7)
  const thisMonthJoined = employees.filter((e: any) => e.joiningDate?.startsWith(thisMonth)).length
  const deptCount = departments.length

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users} label={t('hr.totalEmployees')} value={employees.length} color="bg-blue-50" />
        <StatCard icon={CheckCircle} label={t('hr.activeEmployees')} value={activeEmployees} color="bg-green-50" />
        <StatCard icon={CalendarDays} label={t('hr.thisMonthJoined')} value={thisMonthJoined} color="bg-amber-50" />
        <StatCard icon={UserCog} label={t('hr.departments')} value={deptCount} color="bg-purple-50" />
      </div>

      {/* Actions & Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {canManageEmployees ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1 w-full sm:w-auto">
            <div className="relative flex-1 w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={t('hr.searchEmployees')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 text-sm pl-8"
              />
            </div>
            <Select value={designationFilter} onValueChange={(v) => setDesignationFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="h-9 text-sm w-full sm:w-40"><SelectValue placeholder={t('hr.allDesignations')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t('hr.allDesignations')}</SelectItem>
                {designations.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={departmentFilter} onValueChange={(v) => setDepartmentFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="h-9 text-sm w-full sm:w-40"><SelectValue placeholder={t('hr.allDepartments')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t('hr.allDepartments')}</SelectItem>
                {departments.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div />
        )}
        {isAdmin && (
          <Button onClick={() => setCreateOpen(true)} className="bg-stone-900 hover:bg-stone-800 whitespace-nowrap">
            <Plus className="w-4 h-4 mr-2" />{t('hr.addEmployee')}
          </Button>
        )}
      </div>

      {/* Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('employeeCode')}>{t('hr.employeeCode')}<SortIcon field="employeeCode" sortField={sortField} sortDir={sortDir} /></TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('user.name')}>{t('col.title')}<SortIcon field="user.name" sortField={sortField} sortDir={sortDir} /></TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('designation')}>{t('hr.designation')}<SortIcon field="designation" sortField={sortField} sortDir={sortDir} /></TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('department')}>{t('hr.department')}<SortIcon field="department" sortField={sortField} sortDir={sortDir} /></TableHead>
                  <TableHead className="text-xs">{t('hr.phone')}</TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('baseSalary')}>{t('hr.baseSalary')}<SortIcon field="baseSalary" sortField={sortField} sortDir={sortDir} /></TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('status')}>{t('hr.status')}<SortIcon field="status" sortField={sortField} sortDir={sortDir} /></TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('createdAt')}>{t('hr.joiningDate')}<SortIcon field="createdAt" sortField={sortField} sortDir={sortDir} /></TableHead>
                  <TableHead className="text-xs text-right">{t('col.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <SkeletonRows cols={9} />
                ) : employees.length === 0 ? (
                  <EmptyState icon={Users} message={t('hr.noEmployees')} />
                ) : (
                  sortedEmployees.map((emp: any) => (
                    <TableRow key={emp.id}>
                      <TableCell className="text-xs font-mono font-medium">{emp.employeeCode}</TableCell>
                      <TableCell className="text-xs font-medium">{emp.user?.name || '-'}</TableCell>
                      <TableCell className="text-xs">{emp.designation}</TableCell>
                      <TableCell className="text-xs">{emp.department}</TableCell>
                      <TableCell className="text-xs">{emp.phone || '-'}</TableCell>
                      <TableCell className="text-xs font-medium">₹{Number(emp.baseSalary || 0).toLocaleString('en-IN')}</TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${statusColors[emp.status] || ''}`}>{emp.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString() : '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelected(emp); setViewOpen(true) }}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {isAdmin && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(emp)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-stone-500 hover:text-red-600"
                                onClick={() => { setSelected(emp); setDeleteOpen(true) }}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('hr.addEmployee')}</DialogTitle><DialogDescription>Assign a user as an employee</DialogDescription></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>{t('hr.selectUser')} *</Label>
              <Select value={createForm.userId} onValueChange={(v) => setCreateForm({ ...createForm, userId: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={t('hr.selectUser')} /></SelectTrigger>
                <SelectContent>
                  {users.filter((u: any) => u.isActive).map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('hr.designation')} *</Label>
              <Input className="h-9 text-sm" value={createForm.designation} onChange={(e) => setCreateForm({ ...createForm, designation: e.target.value })} placeholder="e.g. Electrician" />
            </div>
            <div className="space-y-2">
              <Label>{t('hr.department')} *</Label>
              <Input className="h-9 text-sm" value={createForm.department} onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })} placeholder="e.g. Operations" />
            </div>
            <div className="space-y-2">
              <Label>{t('hr.phone')}</Label>
              <Input className="h-9 text-sm" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} placeholder="+91XXXXXXXXXX" />
            </div>
            <div className="space-y-2">
              <Label>{t('hr.baseSalary')} *</Label>
              <Input type="number" className="h-9 text-sm" value={createForm.baseSalary} onChange={(e) => setCreateForm({ ...createForm, baseSalary: e.target.value })} placeholder="25000" />
            </div>
            <div className="space-y-2">
              <Label>{t('hr.bankAccount')}</Label>
              <Input className="h-9 text-sm" value={createForm.bankAccount} onChange={(e) => setCreateForm({ ...createForm, bankAccount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('hr.bankName')}</Label>
              <Input className="h-9 text-sm" value={createForm.bankName} onChange={(e) => setCreateForm({ ...createForm, bankName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('hr.bankIfsc')}</Label>
              <Input className="h-9 text-sm" value={createForm.bankIfsc} onChange={(e) => setCreateForm({ ...createForm, bankIfsc: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('hr.panNumber')}</Label>
              <Input className="h-9 text-sm" value={createForm.panNumber} onChange={(e) => setCreateForm({ ...createForm, panNumber: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('hr.aadhaarNumber')}</Label>
              <Input className="h-9 text-sm" value={createForm.aadhaarNumber} onChange={(e) => setCreateForm({ ...createForm, aadhaarNumber: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t('btn.cancel')}</Button>
            <Button onClick={handleCreate} disabled={actionLoading} className="bg-stone-900 hover:bg-stone-800">
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('btn.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('hr.editEmployee')}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('hr.designation')} *</Label>
              <Input className="h-9 text-sm" value={editForm.designation} onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('hr.department')} *</Label>
              <Input className="h-9 text-sm" value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('hr.phone')}</Label>
              <Input className="h-9 text-sm" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('hr.baseSalary')}</Label>
              <Input type="number" className="h-9 text-sm" value={editForm.baseSalary} onChange={(e) => setEditForm({ ...editForm, baseSalary: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('hr.bankAccount')}</Label>
              <Input className="h-9 text-sm" value={editForm.bankAccount} onChange={(e) => setEditForm({ ...editForm, bankAccount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('hr.bankName')}</Label>
              <Input className="h-9 text-sm" value={editForm.bankName} onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('hr.bankIfsc')}</Label>
              <Input className="h-9 text-sm" value={editForm.bankIfsc} onChange={(e) => setEditForm({ ...editForm, bankIfsc: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('hr.panNumber')}</Label>
              <Input className="h-9 text-sm" value={editForm.panNumber} onChange={(e) => setEditForm({ ...editForm, panNumber: e.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t('hr.aadhaarNumber')}</Label>
              <Input className="h-9 text-sm" value={editForm.aadhaarNumber} onChange={(e) => setEditForm({ ...editForm, aadhaarNumber: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t('btn.cancel')}</Button>
            <Button onClick={handleEdit} disabled={actionLoading} className="bg-stone-900 hover:bg-stone-800">
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('btn.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('hr.employeeDetails')}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t('hr.employeeCode')}</p>
                  <p className="font-mono font-medium">{selected.employeeCode}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t('col.title')}</p>
                  <p className="font-medium">{selected.user?.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t('hr.designation')}</p>
                  <p>{selected.designation}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t('hr.department')}</p>
                  <p>{selected.department}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t('hr.phone')}</p>
                  <p>{selected.phone || '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t('hr.joiningDate')}</p>
                  <p>{selected.joiningDate ? new Date(selected.joiningDate).toLocaleDateString() : '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t('hr.baseSalary')}</p>
                  <p className="font-medium">₹{Number(selected.baseSalary || 0).toLocaleString('en-IN')}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t('hr.status')}</p>
                  <Badge className={`text-[10px] ${statusColors[selected.status] || ''}`}>{selected.status}</Badge>
                </div>
              </div>
              {(selected.bankAccount || selected.bankName || selected.panNumber) && (
                <>
                  <div className="border-t pt-3" />
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bank Details</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t('hr.bankAccount')}</p>
                      <p className="font-mono">{selected.bankAccount || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t('hr.bankName')}</p>
                      <p>{selected.bankName || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t('hr.bankIfsc')}</p>
                      <p className="font-mono">{selected.bankIfsc || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t('hr.panNumber')}</p>
                      <p className="font-mono">{selected.panNumber || '-'}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOpen(false)}>{t('btn.cancel')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('btn.delete')} {t('hr.employee')}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selected?.user?.name || selected?.employeeCode}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('btn.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={actionLoading} className="bg-destructive hover:bg-destructive/90">
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('btn.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ==================== Attendance Tab ====================

function AttendanceTab() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const canManage = user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT'

  const [employees, setEmployees] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [statusFilter, setStatusFilter] = useState('')
  const [localAttendance, setLocalAttendance] = useState<Record<string, string>>({})

  const { sortField, sortDir, handleSort } = useSortState('employeeCode', 'asc')

  const loadEmployees = useCallback(async () => {
    try {
      if (canManage) {
        setEmployees(await api.getEmployees({ status: 'ACTIVE' }))
      } else {
        const emps = await api.getEmployees({ userId: user?.id || '' })
        setEmployees(emps)
      }
    } catch { /* handled */ }
  }, [canManage, user?.id])

  const loadAttendance = useCallback(async () => {
    setLoading(true)
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const data = await api.getAttendance({ date: dateStr })
      const allAttendance = data.data
      // Filter to only current user's records if not admin/accountant
      const visibleAttendance = canManage
        ? allAttendance
        : allAttendance.filter((a: any) => a.employee?.userId === user?.id)
      setAttendance(visibleAttendance)
      // Build local state from loaded data
      const local: Record<string, string> = {}
      visibleAttendance.forEach((a: any) => {
        local[a.employeeId] = a.status
      })
      setLocalAttendance(local)
    } catch { /* handled */ }
    finally { setLoading(false) }
  }, [selectedDate, canManage, user?.id])

  useEffect(() => { loadEmployees() }, [loadEmployees])
  useEffect(() => { loadAttendance() }, [loadAttendance])

  const handleMarkAllPresent = () => {
    const local: Record<string, string> = {}
    employees.forEach((emp: any) => {
      local[emp.id] = 'PRESENT'
    })
    setLocalAttendance(local)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const records = employees.map((emp: any) => ({
        employeeId: emp.id,
        date: dateStr,
        status: localAttendance[emp.id] || 'PRESENT',
      }))
      await api.bulkMarkAttendance(dateStr, records)
      toast({ title: 'Success', description: 'Attendance saved successfully' })
      loadAttendance()
    } catch { /* handled */ }
    finally { setSaving(false) }
  }

  const filteredEmployees = statusFilter
    ? employees.filter((emp: any) => localAttendance[emp.id] === statusFilter)
    : employees

  const displayEmployees = useMemo(() => {
    return filteredEmployees.map(emp => ({
      ...emp,
      _sortStatus: localAttendance[emp.id] || 'PRESENT',
      _sortHours: Number(attendance.find((a: any) => a.employeeId === emp.id)?.hoursWorked) || 0,
    }))
  }, [filteredEmployees, localAttendance, attendance])
  const sortedEmployees = useMemo(() => sortData(displayEmployees, sortField, sortDir), [displayEmployees, sortField, sortDir])

  // Stats
  const presentCount = Object.values(localAttendance).filter((s) => s === 'PRESENT').length
  const absentCount = Object.values(localAttendance).filter((s) => s === 'ABSENT').length
  const leaveCount = Object.values(localAttendance).filter((s) => s === 'LEAVE').length
  const halfDayCount = Object.values(localAttendance).filter((s) => s === 'HALF_DAY').length

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={CheckCircle} label={t('hr.present')} value={presentCount} color="bg-green-50" />
        <StatCard icon={XCircle} label={t('hr.absent')} value={absentCount} color="bg-red-50" />
        <StatCard icon={CalendarDays} label={t('hr.onLeave')} value={leaveCount} color="bg-orange-50" />
        <StatCard icon={Banknote} label={t('hr.halfDay')} value={halfDayCount} color="bg-amber-50" />
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-9 text-sm">
                <CalendarDays className="w-4 h-4 mr-2" />
                {format(selectedDate, 'dd MMM yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
              />
            </PopoverContent>
          </Popover>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="h-9 text-sm w-36"><SelectValue placeholder={t('hr.filterByStatus')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('hr.allStatuses')}</SelectItem>
              {ATTENDANCE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{attendanceLabelMap[s]?.(t) || s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleMarkAllPresent} className="h-9 text-sm">
              <CheckCircle className="w-4 h-4 mr-2" />{t('hr.markAllPresent')}
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-stone-900 hover:bg-stone-800 h-9 text-sm">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('hr.saveAttendance')}
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('employeeCode')}>{t('hr.employeeCode')}<SortIcon field="employeeCode" sortField={sortField} sortDir={sortDir} /></TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('user.name')}>{t('col.title')}<SortIcon field="user.name" sortField={sortField} sortDir={sortDir} /></TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('designation')}>{t('hr.designation')}<SortIcon field="designation" sortField={sortField} sortDir={sortDir} /></TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('_sortStatus')}>{t('hr.status')}<SortIcon field="_sortStatus" sortField={sortField} sortDir={sortDir} /></TableHead>
                  <TableHead className="text-xs">{t('hr.checkIn')}</TableHead>
                  <TableHead className="text-xs">{t('hr.checkOut')}</TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('_sortHours')}>{t('hr.hoursWorked')}<SortIcon field="_sortHours" sortField={sortField} sortDir={sortDir} /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <SkeletonRows cols={7} />
                ) : filteredEmployees.length === 0 ? (
                  <EmptyState icon={CalendarDays} message={t('hr.noAttendance')} />
                ) : (
                  sortedEmployees.map((emp: any) => {
                    const existingRecord = attendance.find((a: any) => a.employeeId === emp.id)
                    const currentStatus = localAttendance[emp.id] || 'PRESENT'
                    return (
                      <TableRow key={emp.id}>
                        <TableCell className="text-xs font-mono">{emp.employeeCode}</TableCell>
                        <TableCell className="text-xs font-medium">{emp.user?.name}</TableCell>
                        <TableCell className="text-xs">{emp.designation}</TableCell>
                        <TableCell>
                          {canManage ? (
                            <Select value={currentStatus} onValueChange={(v) => setLocalAttendance({ ...localAttendance, [emp.id]: v })}>
                              <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {ATTENDANCE_STATUSES.map((s) => (
                                  <SelectItem key={s} value={s}>{attendanceLabelMap[s]?.(t) || s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge className={`text-[10px] ${statusColors[currentStatus] || ''}`}>
                              {attendanceLabelMap[currentStatus]?.(t) || currentStatus}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{existingRecord?.checkIn ? new Date(existingRecord.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</TableCell>
                        <TableCell className="text-xs">{existingRecord?.checkOut ? new Date(existingRecord.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</TableCell>
                        <TableCell className="text-xs">{existingRecord?.hoursWorked || '-'}</TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ==================== Leaves Tab ====================

function LeavesTab() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const canApprove = user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT'

  const [leaves, setLeaves] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const [leaveForm, setLeaveForm] = useState({
    employeeId: '', type: 'CASUAL', startDate: '', endDate: '', reason: '',
  })

  const [employees, setEmployees] = useState<any[]>([])

  const { sortField, sortDir, handleSort } = useSortState('createdAt', 'desc')
  const sortedLeaves = useMemo(() => sortData(leaves, sortField, sortDir), [leaves, sortField, sortDir])

  const loadLeaves = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (statusFilter) params.status = statusFilter
      const data = await api.getLeaves(params)
      const allLeaves = data.data
      // Filter to only current user's records if not admin/accountant
      const visibleLeaves = canApprove
        ? allLeaves
        : allLeaves.filter((l: any) => l.employee?.userId === user?.id)
      setLeaves(visibleLeaves)
    } catch { /* handled */ }
    finally { setLoading(false) }
  }, [statusFilter, canApprove, user?.id])

  const loadEmployees = useCallback(async () => {
    try {
      // Load own employee or all for admin
      if (canApprove) {
        setEmployees(await api.getEmployees({ status: 'ACTIVE' }))
      } else {
        const emps = await api.getEmployees({ userId: user?.id || '' })
        setEmployees(emps)
        if (emps.length > 0) {
          setLeaveForm((f) => ({ ...f, employeeId: emps[0].id }))
        }
      }
    } catch { /* handled */ }
  }, [user?.id, canApprove])

  useEffect(() => { loadLeaves() }, [loadLeaves])
  useEffect(() => { loadEmployees() }, [loadEmployees])

  const handleApplyLeave = async () => {
    if (!leaveForm.employeeId || !leaveForm.type || !leaveForm.startDate || !leaveForm.endDate) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' })
      return
    }
    setActionLoading(true)
    try {
      await api.createLeave(leaveForm)
      toast({ title: 'Success', description: 'Leave applied successfully' })
      setLeaveOpen(false)
      setLeaveForm({ employeeId: '', type: 'CASUAL', startDate: '', endDate: '', reason: '' })
      loadLeaves()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const handleApprove = async (id: string) => {
    setActionLoading(true)
    try {
      await api.approveLeave(id)
      toast({ title: 'Success', description: 'Leave approved' })
      loadLeaves()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast({ title: 'Error', description: 'Rejection reason is required', variant: 'destructive' })
      return
    }
    setActionLoading(true)
    try {
      await api.rejectLeave(selected.id, rejectReason)
      toast({ title: 'Success', description: 'Leave rejected' })
      setRejectOpen(false)
      setRejectReason('')
      loadLeaves()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  const handleCancel = async (id: string) => {
    setActionLoading(true)
    try {
      await api.cancelLeave(id)
      toast({ title: 'Success', description: 'Leave cancelled' })
      loadLeaves()
    } catch { /* handled */ }
    finally { setActionLoading(false) }
  }

  // Stats
  const pendingCount = leaves.filter((l: any) => l.status === 'PENDING').length
  const approvedThisMonth = leaves.filter((l: any) => {
    if (l.status !== 'APPROVED') return false
    const month = new Date().toISOString().slice(0, 7)
    return l.startDate?.startsWith(month) || l.createdAt?.startsWith(month)
  }).length
  const rejectedCount = leaves.filter((l: any) => l.status === 'REJECTED').length
  const totalDays = leaves.reduce((sum: number, l: any) => sum + (l.totalDays || 0), 0)

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={CalendarDays} label={t('hr.pendingLeaves')} value={pendingCount} color="bg-amber-50" />
        <StatCard icon={CheckCircle} label={t('hr.approvedThisMonth')} value={approvedThisMonth} color="bg-green-50" />
        <StatCard icon={XCircle} label={t('hr.rejected')} value={rejectedCount} color="bg-red-50" />
        <StatCard icon={Banknote} label={t('hr.totalLeaveDays')} value={totalDays} color="bg-blue-50" />
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {LEAVE_STATUSES.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? 'default' : 'outline'}
              size="sm"
              className={`h-8 text-xs ${statusFilter === s ? 'bg-stone-900 hover:bg-stone-800' : ''}`}
              onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
            >
              {s}
              <Badge className={`ml-1.5 text-[9px] px-1 ${statusColors[s]}`}>
                {leaves.filter((l: any) => l.status === s).length}
              </Badge>
            </Button>
          ))}
        </div>
        <Button onClick={() => setLeaveOpen(true)} className="bg-stone-900 hover:bg-stone-800 h-9 text-sm">
          <Plus className="w-4 h-4 mr-2" />{t('hr.applyLeave')}
        </Button>
      </div>

      {/* Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('employee.user.name')}>{t('hr.employee')}<SortIcon field="employee.user.name" sortField={sortField} sortDir={sortDir} /></TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('type')}>{t('hr.leaveType')}<SortIcon field="type" sortField={sortField} sortDir={sortDir} /></TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('startDate')}>{t('hr.from')}<SortIcon field="startDate" sortField={sortField} sortDir={sortDir} /></TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('endDate')}>{t('hr.to')}<SortIcon field="endDate" sortField={sortField} sortDir={sortDir} /></TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('totalDays')}>{t('hr.days')}<SortIcon field="totalDays" sortField={sortField} sortDir={sortDir} /></TableHead>
                  <TableHead className="text-xs">{t('hr.reason')}</TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('status')}>{t('hr.status')}<SortIcon field="status" sortField={sortField} sortDir={sortDir} /></TableHead>
                  <TableHead className="text-xs text-right">{t('col.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <SkeletonRows cols={8} />
                ) : leaves.length === 0 ? (
                  <EmptyState icon={CalendarDays} message={t('hr.noLeaves')} />
                ) : (
                  sortedLeaves.map((leave: any) => (
                    <TableRow key={leave.id}>
                      <TableCell className="text-xs font-medium">{leave.employee?.user?.name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {leaveTypeLabelMap[leave.type]?.(t) || leave.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{leave.startDate ? new Date(leave.startDate).toLocaleDateString() : '-'}</TableCell>
                      <TableCell className="text-xs">{leave.endDate ? new Date(leave.endDate).toLocaleDateString() : '-'}</TableCell>
                      <TableCell className="text-xs font-medium">{leave.totalDays || '-'}</TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate">{leave.reason || '-'}</TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${statusColors[leave.status] || ''}`}>{leave.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canApprove && leave.status === 'PENDING' && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700"
                                onClick={() => handleApprove(leave.id)}>
                                <CheckCircle className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-700"
                                onClick={() => { setSelected(leave); setRejectOpen(true) }}>
                                <XCircle className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                          {leave.status === 'PENDING' && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-stone-500 hover:text-stone-700"
                              onClick={() => handleCancel(leave.id)} disabled={actionLoading}>
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
          </div>
        </CardContent>
      </Card>

      {/* Apply Leave Dialog */}
      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{t('hr.applyLeave')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {canApprove && (
              <div className="space-y-2">
                <Label>{t('hr.employee')} *</Label>
                <Select value={leaveForm.employeeId} onValueChange={(v) => setLeaveForm({ ...leaveForm, employeeId: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={t('hr.selectUser')} /></SelectTrigger>
                  <SelectContent>
                    {employees.map((emp: any) => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.user?.name} ({emp.employeeCode})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>{t('hr.leaveType')} *</Label>
              <Select value={leaveForm.type} onValueChange={(v) => setLeaveForm({ ...leaveForm, type: v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{leaveTypeLabelMap[type]?.(t) || type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('hr.startDate')} *</Label>
                <Input type="date" className="h-9 text-sm" value={leaveForm.startDate}
                  onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t('hr.endDate')} *</Label>
                <Input type="date" className="h-9 text-sm" value={leaveForm.endDate}
                  onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('hr.reason')}</Label>
              <Textarea className="text-sm min-h-[60px]" value={leaveForm.reason}
                onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                placeholder="Reason for leave..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveOpen(false)}>{t('btn.cancel')}</Button>
            <Button onClick={handleApplyLeave} disabled={actionLoading} className="bg-stone-900 hover:bg-stone-800">
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('btn.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{t('hr.rejectReason')}</DialogTitle></DialogHeader>
          <Textarea className="text-sm min-h-[80px]" value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter reason for rejection..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>{t('btn.cancel')}</Button>
            <Button onClick={handleReject} disabled={actionLoading} variant="destructive">
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{t('btn.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ==================== Salaries Tab ====================

function SalariesTab() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const canManage = user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT'
  const isAdmin = user?.role === 'ADMIN'

  const [salaries, setSalaries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [markingPaid, setMarkingPaid] = useState<string | null>(null)

  const currentMonth = format(new Date(), 'yyyy-MM')
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)

  const { sortField, sortDir, handleSort } = useSortState('baseSalary', 'asc')
  const sortedSalaries = useMemo(() => sortData(salaries, sortField, sortDir), [salaries, sortField, sortDir])

  const loadSalaries = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getSalaries({ month: selectedMonth })
      const allSalaries = data.data
      // Filter to only current user's records if not admin/accountant
      const visibleSalaries = canManage
        ? allSalaries
        : allSalaries.filter((s: any) => s.employee?.userId === user?.id)
      setSalaries(visibleSalaries)
    } catch { /* handled */ }
    finally { setLoading(false) }
  }, [selectedMonth, canManage, user?.id])

  useEffect(() => { loadSalaries() }, [loadSalaries])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await api.createSalary({ month: selectedMonth })
      toast({ title: 'Success', description: 'Salaries generated successfully' })
      loadSalaries()
    } catch { /* handled */ }
    finally { setGenerating(false) }
  }

  const handleMarkPaid = async (id: string) => {
    setMarkingPaid(id)
    try {
      await api.markSalaryPaid(id)
      toast({ title: 'Success', description: 'Salary marked as paid' })
      loadSalaries()
    } catch { /* handled */ }
    finally { setMarkingPaid(null) }
  }

  // Stats
  const totalDisbursed = salaries.filter((s: any) => s.status === 'PAID').reduce((sum: number, s: any) => sum + (s.netSalary || 0), 0)
  const pendingPayment = salaries.filter((s: any) => s.status === 'UNPAID').reduce((sum: number, s: any) => sum + (s.netSalary || 0), 0)
  const employeeCount = salaries.length

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard icon={Banknote} label={t('hr.totalDisbursed')} value={`₹${totalDisbursed.toLocaleString('en-IN')}`} color="bg-emerald-50" />
        <StatCard icon={CalendarDays} label={t('hr.pendingPayment')} value={`₹${pendingPayment.toLocaleString('en-IN')}`} color="bg-amber-50" />
        <StatCard icon={Users} label={t('hr.employees')} value={employeeCount} color="bg-blue-50" />
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Input
            type="month"
            className="h-9 text-sm w-44"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
        </div>
        {canManage && (
          <Button onClick={handleGenerate} disabled={generating} className="bg-stone-900 hover:bg-stone-800 h-9 text-sm">
            {generating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Banknote className="w-4 h-4 mr-2" />{t('hr.generateSalaries')}
          </Button>
        )}
      </div>

      {/* Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('employee.employeeCode')}>{t('hr.employeeCode')}<SortIcon field="employee.employeeCode" sortField={sortField} sortDir={sortDir} /></TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('employee.user.name')}>{t('col.title')}<SortIcon field="employee.user.name" sortField={sortField} sortDir={sortDir} /></TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('baseSalary')}>{t('hr.baseSalary')}<SortIcon field="baseSalary" sortField={sortField} sortDir={sortDir} /></TableHead>
                  <TableHead className="text-xs">{t('hr.hra')}</TableHead>
                  <TableHead className="text-xs">{t('hr.da')}</TableHead>
                  <TableHead className="text-xs">{t('hr.ta')}</TableHead>
                  <TableHead className="text-xs">{t('hr.bonus')}</TableHead>
                  <TableHead className="text-xs">{t('hr.deductions')}</TableHead>
                  <TableHead className="text-xs">{t('hr.pf')}</TableHead>
                  <TableHead className="text-xs">{t('hr.tds')}</TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('netSalary')}>{t('hr.netSalary')}<SortIcon field="netSalary" sortField={sortField} sortDir={sortDir} /></TableHead>
                  <TableHead className="text-xs cursor-pointer select-none" onClick={() => handleSort('status')}>{t('hr.status')}<SortIcon field="status" sortField={sortField} sortDir={sortDir} /></TableHead>
                  {isAdmin && <TableHead className="text-xs text-right">{t('col.actions')}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <SkeletonRows cols={isAdmin ? 13 : 12} rows={3} />
                ) : salaries.length === 0 ? (
                  <EmptyState icon={Banknote} message={t('hr.noSalaries')} />
                ) : (
                  sortedSalaries.map((sal: any) => (
                    <TableRow key={sal.id}>
                      <TableCell className="text-xs font-mono">{sal.employee?.employeeCode || '-'}</TableCell>
                      <TableCell className="text-xs font-medium">{sal.employee?.user?.name || '-'}</TableCell>
                      <TableCell className="text-xs">₹{Number(sal.baseSalary || 0).toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-xs">₹{Number(sal.hra || 0).toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-xs">₹{Number(sal.da || 0).toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-xs">₹{Number(sal.ta || 0).toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-xs">₹{Number(sal.bonus || 0).toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-xs text-red-600">₹{Number(sal.deductions || 0).toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-xs text-red-600">₹{Number(sal.pf || 0).toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-xs text-red-600">₹{Number(sal.tds || 0).toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-xs font-semibold">₹{Number(sal.netSalary || 0).toLocaleString('en-IN')}</TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${statusColors[sal.status] || ''}`}>
                          {sal.status === 'UNPAID' ? t('hr.pending') : sal.status}
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          {sal.status === 'UNPAID' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs text-emerald-600 hover:text-emerald-700 border-emerald-200"
                              onClick={() => handleMarkPaid(sal.id)}
                              disabled={markingPaid === sal.id}
                            >
                              {markingPaid === sal.id ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3 h-3 mr-1" />
                              )}
                              {t('btn.markPaid')}
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ==================== Main Page ====================

export function EmployeesPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const isAccountant = user?.role === 'ACCOUNTANT'

  // All authenticated users can see the page, but with different tab access
  const canSeeSalaries = isAdmin || isAccountant
  const canManageEmployees = isAdmin || isAccountant

  // Default tab: employees for managers, attendance for regular users
  const defaultTab = canManageEmployees ? 'employees' : 'attendance'

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-stone-900">{t('hr.title')}</h2>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          {canManageEmployees && (
            <TabsTrigger value="employees" className="text-xs">
              <Users className="w-3.5 h-3.5 mr-1.5" />{t('hr.employees')}
            </TabsTrigger>
          )}
          <TabsTrigger value="attendance" className="text-xs">
            <CalendarDays className="w-3.5 h-3.5 mr-1.5" />{t('hr.attendance')}
          </TabsTrigger>
          <TabsTrigger value="leaves" className="text-xs">
            <CalendarDays className="w-3.5 h-3.5 mr-1.5" />{t('hr.leaves')}
          </TabsTrigger>
          {canSeeSalaries && (
            <TabsTrigger value="salaries" className="text-xs">
              <Banknote className="w-3.5 h-3.5 mr-1.5" />{t('hr.salaries')}
            </TabsTrigger>
          )}
        </TabsList>

        {canManageEmployees && (
          <TabsContent value="employees" className="mt-4">
            <EmployeesTab />
          </TabsContent>
        )}

        <TabsContent value="attendance" className="mt-4">
          <AttendanceTab />
        </TabsContent>

        <TabsContent value="leaves" className="mt-4">
          <LeavesTab />
        </TabsContent>

        {canSeeSalaries && (
          <TabsContent value="salaries" className="mt-4">
            <SalariesTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
