'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { formatDateTime } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ScrollText, ChevronLeft, ChevronRight, Search } from 'lucide-react'

const ACTION_TYPES = [
  'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'RETURN', 'RESUBMIT',
  'MARK_PAID', 'BULK_ACTION', 'BULK_UPLOAD', 'RESET_ALL_DATA', 'ADD_COMMENT',
  'LOGIN', 'LOGOUT', 'CHANGE_PASSWORD',
]

const ENTITY_TYPES = [
  'Expense', 'Advance', 'Requisition', 'BOQItem', 'Site', 'Client', 'Category',
  'User', 'Employee', 'Leave', 'SYSTEM', 'BULK_UPLOAD',
]

function getActionBadgeVariant(action: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (action.includes('DELETE') || action.includes('REJECT') || action.includes('RESET')) return 'destructive'
  if (action.includes('CREATE') || action.includes('APPROVE') || action.includes('MARK_PAID') || action.includes('LOGIN')) return 'default'
  if (action.includes('UPDATE') || action.includes('RETURN') || action.includes('RESUBMIT') || action.includes('BULK')) return 'secondary'
  return 'outline'
}

export function AuditLogsPage() {
  const { user } = useAuth()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState('20')
  const [userId, setUserId] = useState('')
  const [action, setAction] = useState('')
  const [entityType, setEntityType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, pageSize, userId, action, entityType, dateFrom, dateTo],
    queryFn: () => {
      const params: Record<string, string> = { page: String(page), pageSize }
      if (userId) params.userId = userId
      if (action) params.action = action
      if (entityType) params.entityType = entityType
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      return api.getAuditLogs(params) as Promise<{
        logs: Array<{
          id: string
          action: string
          entityType: string
          entityId: string | null
          oldValues: string | null
          newValues: string | null
          ipAddress: string | null
          createdAt: string
          user: { id: string; name: string; email: string; role: string }
        }>
        pagination: { page: number; pageSize: number; total: number; totalPages: number }
      }>
    },
  })

  // Fetch users for filter dropdown
  const { data: users } = useQuery({
    queryKey: ['users-list-audit'],
    queryFn: () => api.getUsers() as Promise<Array<{ id: string; name: string; email: string }>>,
  })

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">Access denied. Admin only.</p>
      </div>
    )
  }

  const logs = data?.logs || []
  const pagination = data?.pagination

  const clearFilters = () => {
    setUserId('')
    setAction('')
    setEntityType('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const hasFilters = userId || action || entityType || dateFrom || dateTo

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-amber-500" />
            Audit Logs
          </h2>
          <p className="text-sm text-slate-500 mt-1">Track all system activities and changes</p>
        </div>
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={clearFilters} className="gap-2">
            <Search className="w-4 h-4" />
            Clear Filters
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="rounded-xl shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">User</label>
              <Select value={userId} onValueChange={(v) => { setUserId(v === 'all' ? '' : v); setPage(1) }}>
                <SelectTrigger><SelectValue placeholder="All Users" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {(users || []).map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Action</label>
              <Select value={action} onValueChange={(v) => { setAction(v === 'all' ? '' : v); setPage(1) }}>
                <SelectTrigger><SelectValue placeholder="All Actions" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {ACTION_TYPES.map(a => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Entity Type</label>
              <Select value={entityType} onValueChange={(v) => { setEntityType(v === 'all' ? '' : v); setPage(1) }}>
                <SelectTrigger><SelectValue placeholder="All Entities" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  {ENTITY_TYPES.map(e => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Date From</label>
              <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Date To</label>
              <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="rounded-xl shadow-sm">
        <CardContent className="p-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <ScrollText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No audit logs found</p>
            </div>
          ) : (
            <>
              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-[160px]">Timestamp</TableHead>
                      <TableHead className="text-xs">User</TableHead>
                      <TableHead className="text-xs">Action</TableHead>
                      <TableHead className="text-xs">Entity</TableHead>
                      <TableHead className="text-xs">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                          {formatDateTime(log.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-navy-900 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                              {log.user.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-navy-900 truncate">{log.user.name}</p>
                              <p className="text-[10px] text-slate-400 truncate">{log.user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getActionBadgeVariant(log.action)} className="text-[10px]">
                            {log.action.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-slate-600">
                            {log.entityType}
                            {log.entityId ? (
                              <span className="text-[10px] text-slate-400 block">ID: {log.entityId.substring(0, 8)}...</span>
                            ) : null}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <p className="text-xs text-slate-500 truncate" title={log.newValues || log.oldValues || ''}>
                            {log.newValues || log.oldValues || '—'}
                          </p>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500">
                    Showing {(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline" size="icon" className="h-8 w-8"
                      disabled={pagination.page <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs text-slate-600">Page {pagination.page} of {pagination.totalPages}</span>
                    <Button
                      variant="outline" size="icon" className="h-8 w-8"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => setPage(p => p + 1)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
