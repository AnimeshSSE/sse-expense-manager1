'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search, X, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ClipboardList,
  FileDown, FileText, FileSpreadsheet, Loader2,
} from 'lucide-react'
import { exportToCSV, exportToXLS, exportToPDF } from '@/lib/export'

const boqExportColumns = [
  { key: 'itemName', label: 'Item Name' },
  { key: 'description', label: 'Description' },
  { key: 'quantity', label: 'Qty' },
  { key: 'unit', label: 'Unit' },
  { key: 'unitPrice', label: 'Unit Price (₹)' },
  { key: 'totalPrice', label: 'Total (₹)' },
  { key: 'category', label: 'Category' },
  { key: 'requisition.title', label: 'Request Title', format: (_v: any, row: any) => row['requisition.title'] || '' },
  { key: 'requisition.site.name', label: 'Site', format: (_v: any, row: any) => row['requisition.site.name'] || '' },
  { key: 'requisition.site.client.name', label: 'Client', format: (_v: any, row: any) => row['requisition.site.client.name'] || '' },
]

export function BoqPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [filters, setFilters] = useState({
    clientId: '',
    siteId: '',
    unit: '',
    minPrice: '',
    maxPrice: '',
    search: '',
  })
  const [sortField, setSortField] = useState('itemName')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [clients, setClients] = useState<any[]>([])
  const [sites, setSites] = useState<any[]>([])

  const loadClients = useCallback(async () => {
    try { setClients(await api.getClients() || []) } catch { /* handled */ }
  }, [])

  const loadSites = useCallback(async () => {
    try { setSites(await api.getSites() || []) } catch { /* handled */ }
  }, [])

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (filters.siteId) params.siteId = filters.siteId
      if (filters.unit) params.unit = filters.unit
      if (filters.minPrice) params.minPrice = filters.minPrice
      if (filters.maxPrice) params.maxPrice = filters.maxPrice
      if (filters.search) params.search = filters.search
      const result = await api.getBoqItems(params)
      setItems(result || [])
    } catch { /* handled */ }
    finally { setLoading(false) }
  }, [filters])

  useEffect(() => { loadClients(); loadSites() }, [loadClients, loadSites])
  useEffect(() => { loadItems() }, [loadItems])

  // Filter sites based on selected client
  const filteredSites = filters.clientId
    ? sites.filter((s: any) => s.clientId === filters.clientId)
    : sites

  // Client-side sort and paginate
  const sorted = [...items].sort((a, b) => {
    const getNestedVal = (obj: any, key: string) => {
      const parts = key.split('.')
      let val = obj
      for (const p of parts) {
        val = val?.[p]
      }
      return val
    }
    const aVal = getNestedVal(a, sortField) || ''
    const bVal = getNestedVal(b, sortField) || ''
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

  const units = [...new Set(items.map((i: any) => i.unit).filter(Boolean))]

  const hasActiveFilters = Object.values(filters).some((v) => v !== '')

  const clearFilters = () => {
    setFilters({ clientId: '', siteId: '', unit: '', minPrice: '', maxPrice: '', search: '' })
    setPage(1)
  }

  // Fetch ALL filtered BOQ items (bypasses pagination)
  const fetchAllFilteredBoqItems = async (): Promise<any[]> => {
    const params: Record<string, string> = {
      page: '1',
      pageSize: '9999',
    }
    if (filters.siteId) params.siteId = filters.siteId
    if (filters.unit) params.unit = filters.unit
    if (filters.minPrice) params.minPrice = filters.minPrice
    if (filters.maxPrice) params.maxPrice = filters.maxPrice
    if (filters.search) params.search = filters.search
    try {
      const result = await api.getBoqItems(params)
      return result || []
    } catch {
      return []
    }
  }

  const flattenBoqItems = (data: any[]) =>
    data.map(item => ({
      ...item,
      'requisition.title': item.requisition?.title || '',
      'requisition.site.name': item.requisition?.site?.name || '',
      'requisition.site.client.name': item.requisition?.site?.client?.name || '',
    }))

  const handleExportCSV = async () => {
    setExporting(true)
    try {
      const allData = await fetchAllFilteredBoqItems()
      if (allData.length === 0) {
        toast({ title: 'No data', description: 'No BOQ items match current filters', variant: 'destructive' })
        return
      }
      exportToCSV(flattenBoqItems(allData), boqExportColumns, `boq-items-${new Date().toISOString().slice(0, 10)}`)
      toast({ title: 'Exported', description: `${allData.length} BOQ items exported as CSV` })
    } catch {
      toast({ title: 'Error', description: 'Export failed', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  const handleExportXLS = async () => {
    setExporting(true)
    try {
      const allData = await fetchAllFilteredBoqItems()
      if (allData.length === 0) {
        toast({ title: 'No data', description: 'No BOQ items match current filters', variant: 'destructive' })
        return
      }
      await exportToXLS(flattenBoqItems(allData), boqExportColumns, `boq-items-${new Date().toISOString().slice(0, 10)}`)
      toast({ title: 'Exported', description: `${allData.length} BOQ items exported as Excel` })
    } catch {
      toast({ title: 'Error', description: 'Export failed', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  const handleExportPDF = async () => {
    setExporting(true)
    try {
      const allData = await fetchAllFilteredBoqItems()
      if (allData.length === 0) {
        toast({ title: 'No data', description: 'No BOQ items match current filters', variant: 'destructive' })
        return
      }
      await exportToPDF(flattenBoqItems(allData), boqExportColumns, `boq-items-${new Date().toISOString().slice(0, 10)}`, 'BOQ Items Report')
      toast({ title: 'Exported', description: `${allData.length} BOQ items exported as PDF` })
    } catch {
      toast({ title: 'Error', description: 'Export failed', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">BOQ Items</h2>
            <p className="text-sm text-stone-500">Bill of Quantities from all material requisitions</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={exporting}>
                {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
                {exporting ? 'Exporting...' : 'Export'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCSV}>
                <FileText className="w-4 h-4 mr-2" />
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportXLS}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF}>
                <FileDown className="w-4 h-4 mr-2" />
                Export PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Badge variant="secondary" className="text-xs">{items.length} items</Badge>
        </div>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <Input placeholder="Search BOQ items..." className="h-8 pl-9 text-xs"
                value={filters.search} onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1) }} />
            </div>
            <Select value={filters.clientId} onValueChange={(v) => { setFilters({ ...filters, clientId: v === '__all__' ? '' : v, siteId: '' }); setPage(1) }}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All Clients" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" className="text-xs">All Clients</SelectItem>
                {clients.map((c: any) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.siteId} onValueChange={(v) => { setFilters({ ...filters, siteId: v === '__all__' ? '' : v }); setPage(1) }}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="All Sites" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" className="text-xs">All Sites</SelectItem>
                {filteredSites.map((s: any) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.unit} onValueChange={(v) => { setFilters({ ...filters, unit: v === '__all__' ? '' : v }); setPage(1) }}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="All Units" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__" className="text-xs">All Units</SelectItem>
                {units.map((u) => (
                  <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Min Price" className="h-8 w-28 text-xs"
              value={filters.minPrice} onChange={(e) => { setFilters({ ...filters, minPrice: e.target.value }); setPage(1) }} />
            <Input type="number" placeholder="Max Price" className="h-8 w-28 text-xs"
              value={filters.maxPrice} onChange={(e) => { setFilters({ ...filters, maxPrice: e.target.value }); setPage(1) }} />
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
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
                  <TableHead className="text-xs cursor-pointer" onClick={() => handleSort('itemName')}>
                    <div className="flex items-center gap-1">Item Name <SortIcon field="itemName" /></div>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer" onClick={() => handleSort('description')}>
                    <div className="flex items-center gap-1">Description <SortIcon field="description" /></div>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer" onClick={() => handleSort('quantity')}>
                    <div className="flex items-center gap-1">Qty <SortIcon field="quantity" /></div>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer" onClick={() => handleSort('unit')}>
                    <div className="flex items-center gap-1">Unit <SortIcon field="unit" /></div>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer" onClick={() => handleSort('unitPrice')}>
                    <div className="flex items-center gap-1">Unit Price <SortIcon field="unitPrice" /></div>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer" onClick={() => handleSort('totalPrice')}>
                    <div className="flex items-center gap-1">Total <SortIcon field="totalPrice" /></div>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer" onClick={() => handleSort('category')}>
                    <div className="flex items-center gap-1">Category <SortIcon field="category" /></div>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer" onClick={() => handleSort('requisition.title')}>
                    <div className="flex items-center gap-1">Request Title <SortIcon field="requisition.title" /></div>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer" onClick={() => handleSort('requisition.site.name')}>
                    <div className="flex items-center gap-1">Site <SortIcon field="requisition.site.name" /></div>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer" onClick={() => handleSort('requisition.site.client.name')}>
                    <div className="flex items-center gap-1">Client <SortIcon field="requisition.site.client.name" /></div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>{[...Array(10)].map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}</TableRow>
                  ))
                ) : paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-stone-400 text-sm">
                      <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No BOQ items found
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs font-medium">{item.itemName}</TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate">{item.description || '-'}</TableCell>
                      <TableCell className="text-xs">{item.quantity}</TableCell>
                      <TableCell className="text-xs">{item.unit}</TableCell>
                      <TableCell className="text-xs">₹ {item.unitPrice?.toLocaleString()}</TableCell>
                      <TableCell className="text-xs font-medium">₹ {item.totalPrice?.toLocaleString()}</TableCell>
                      <TableCell className="text-xs">
                        {item.category ? (
                          <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate">{item.requisition?.title || '-'}</TableCell>
                      <TableCell className="text-xs">{item.requisition?.site?.name || '-'}</TableCell>
                      <TableCell className="text-xs">{item.requisition?.site?.client?.name || '-'}</TableCell>
                    </TableRow>
                  ))
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
