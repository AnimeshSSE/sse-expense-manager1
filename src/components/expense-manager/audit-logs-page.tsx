'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Search, X, ChevronDown, ChevronUp, FileText, ChevronLeft, ChevronRight,
} from 'lucide-react'

const ACTION_TYPES = [
  'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'RETURN',
  'LOGIN', 'LOGOUT', 'MARK_PAID', 'ORDER', 'RECEIVE', 'RESUBMIT',
  'CHANGE_PASSWORD', 'SEED',
]

const ENTITY_TYPES = [
  'User', 'Client', 'Site', 'Category', 'Expense', 'Requisition',
  'BOQItem', 'AuditLog',
]

export function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    dateFrom: '',
    dateTo: '',
  })
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [sortField, setSortField] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (filters.action) params.action = filters.action
      if (filters.entityType) params.entityType = filters.entityType
      if (filters.dateFrom) params.dateFrom = filters.dateFrom
      if (filters.dateTo) params.dateTo = filters.dateTo
      const result = await api.getAuditLogs(params)
      setLogs(result?.logs || [])
    } catch { /* handled */ }
    finally { setLoading(false) }
  }, [filters])

  useEffect(() => { loadLogs() }, [loadLogs])

  const sorted = [...logs].sort((a, b) => {
    const aVal = a[sortField] || ''
    const bVal = b[sortField] || ''
    const cmp = typeof aVal === 'number' && typeof bVal === 'number'
      ? aVal - bVal
      : String(aVal).localeCompare(String(bVal))
    return sortDir === 'asc' ? cmp : -cmp
  })

  const totalPages = Math.ceil(sorted.length / limit)
  const paged = sorted.slice((page - 1) * limit, page * limit)

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
    setPage(1)
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ChevronUp className="w-3 h-3 opacity-20" />
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
  }

  const hasActiveFilters = Object.values(filters).some((v) => v !== '')

  const parseJson = (str: string) => {
    try { return JSON.parse(str) } catch { return null }
  }

  const actionColors: Record<string, string> = {
    CREATE: 'bg-green-100 text-green-800',
    UPDATE: 'bg-blue-100 text-blue-800',
    DELETE: 'bg-red-100 text-red-800',
    APPROVE: 'bg-emerald-100 text-emerald-800',
    REJECT: 'bg-red-100 text-red-800',
    RETURN: 'bg-orange-100 text-orange-800',
    LOGIN: 'bg-stone-100 text-stone-800',
    LOGOUT: 'bg-stone-100 text-stone-800',
    MARK_PAID: 'bg-green-100 text-green-800',
    ORDER: 'bg-teal-100 text-teal-800',
    RECEIVE: 'bg-green-100 text-green-800',
    RESUBMIT: 'bg-cyan-100 text-cyan-800',
    CHANGE_PASSWORD: 'bg-amber-100 text-amber-800',
    SEED: 'bg-purple-100 text-purple-800',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Audit Logs</h2>
          <p className="text-sm text-stone-500">Track all system activities</p>
        </div>
        <Badge variant="secondary" className="text-xs">{logs.length} entries</Badge>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={filters.action} onValueChange={(v) => { setFilters({ ...filters, action: v === '__all__' ? '' : v }); setPage(1) }}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All Actions" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" className="text-xs">All Actions</SelectItem>
                {ACTION_TYPES.map((a) => (
                  <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.entityType} onValueChange={(v) => { setFilters({ ...filters, entityType: v === '__all__' ? '' : v }); setPage(1) }}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All Entities" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" className="text-xs">All Entities</SelectItem>
                {ENTITY_TYPES.map((e) => (
                  <SelectItem key={e} value={e} className="text-xs">{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" className="h-8 w-36 text-xs" value={filters.dateFrom}
              onChange={(e) => { setFilters({ ...filters, dateFrom: e.target.value }); setPage(1) }} />
            <Input type="date" className="h-8 w-36 text-xs" value={filters.dateTo}
              onChange={(e) => { setFilters({ ...filters, dateTo: e.target.value }); setPage(1) }} />
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-8 text-xs"
                onClick={() => setFilters({ action: '', entityType: '', dateFrom: '', dateTo: '' })}>
                <X className="w-3 h-3 mr-1" />Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs cursor-pointer" onClick={() => handleSort('createdAt')}>
                    <div className="flex items-center gap-1">Date <SortIcon field="createdAt" /></div>
                  </TableHead>
                  <TableHead className="text-xs">User</TableHead>
                  <TableHead className="text-xs">Action</TableHead>
                  <TableHead className="text-xs">Entity</TableHead>
                  <TableHead className="text-xs">Entity ID</TableHead>
                  <TableHead className="text-xs">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>{[...Array(6)].map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}</TableRow>
                  ))
                ) : paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-stone-400 text-sm">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />No audit logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((log: any) => {
                    const oldVal = parseJson(log.oldValues)
                    const newVal = parseJson(log.newValues)
                    const hasDetails = oldVal || newVal
                    const isExpanded = expandedRow === log.id

                    return (
                      <>
                        <TableRow
                          key={log.id}
                          className="cursor-pointer"
                          onClick={() => hasDetails && setExpandedRow(isExpanded ? null : log.id)}
                        >
                          <TableCell className="text-xs">
                            {log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}
                          </TableCell>
                          <TableCell className="text-xs">{log.user?.name || '-'}</TableCell>
                          <TableCell>
                            <Badge className={`text-[10px] ${actionColors[log.action] || 'bg-stone-100 text-stone-800'}`}>
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{log.entityType}</TableCell>
                          <TableCell className="text-xs font-mono text-[11px] max-w-[80px] truncate">
                            {log.entityId ? log.entityId.slice(0, 8) + '...' : '-'}
                          </TableCell>
                          <TableCell className="text-xs">
                            {hasDetails ? (
                              <div className="flex items-center gap-1 text-stone-500">
                                <span>View changes</span>
                                <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </div>
                            ) : (
                              <span className="text-stone-400">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                        {isExpanded && hasDetails && (
                          <TableRow key={`${log.id}-detail`}>
                            <TableCell colSpan={6} className="bg-stone-50 p-4">
                              <div className="grid md:grid-cols-2 gap-4">
                                {oldVal && (
                                  <div>
                                    <p className="text-xs font-medium text-red-600 mb-2">Old Values</p>
                                    <pre className="text-xs bg-white p-3 rounded-lg border overflow-x-auto max-h-48 overflow-y-auto">
                                      {JSON.stringify(oldVal, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {newVal && (
                                  <div>
                                    <p className="text-xs font-medium text-green-600 mb-2">New Values</p>
                                    <pre className="text-xs bg-white p-3 rounded-lg border overflow-x-auto max-h-48 overflow-y-auto">
                                      {JSON.stringify(newVal, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-stone-500">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, sorted.length)} of {sorted.length}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7"
                  onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pn: number
                  if (totalPages <= 5) pn = i + 1
                  else if (page <= 3) pn = i + 1
                  else if (page >= totalPages - 2) pn = totalPages - 4 + i
                  else pn = page - 2 + i
                  return (
                    <Button key={pn} variant={page === pn ? 'default' : 'outline'} size="icon"
                      className="h-7 w-7 text-xs" onClick={() => setPage(pn)}>
                      {pn}
                    </Button>
                  )
                })}
                <Button variant="outline" size="icon" className="h-7 w-7"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
