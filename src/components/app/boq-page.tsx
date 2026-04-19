'use client'

import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Eye, ClipboardList } from 'lucide-react'

// ==================== TYPES ====================
interface BOQItem {
  id: string
  requisitionId: string
  itemName: string
  description: string | null
  quantity: number
  unit: string
  unitPrice: number
  totalPrice: number
  category: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  requisition: {
    id: string
    title: string
    status: string
    site: {
      id: string
      name: string
      client: { id: string; name: string } | null
    }
    user: { id: string; name: string }
  }
}

// ==================== COMPONENT ====================
export function BOQPage() {
  // Filters
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [priceFrom, setPriceFrom] = useState('')
  const [priceTo, setPriceTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)

  // View dialog
  const [showView, setShowView] = useState(false)
  const [viewItem, setViewItem] = useState<BOQItem | null>(null)

  const { data: boqData, isLoading } = useQuery({
    queryKey: ['boq', search, categoryFilter, priceFrom, priceTo, page, pageSize],
    queryFn: () => api.getBOQItems({
      search, category: categoryFilter,
      priceFrom: priceFrom || '',
      priceTo: priceTo || '',
      page: String(page), pageSize: String(pageSize),
      sortBy: 'createdAt', sortOrder: 'desc',
    }),
  })

  const boqItems: BOQItem[] = (boqData as any)?.data || []
  const pagination = (boqData as any)?.pagination || { page: 1, pageSize, total: 0, totalPages: 0 }

  // Gather unique categories from current data for filter
  const categories = Array.from(new Set(boqItems.map(i => i.category).filter(Boolean) as string[])).sort()

  const openView = useCallback((item: BOQItem) => {
    setViewItem(item)
    setShowView(true)
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-navy-900">BOQ Items Reference</h2>
        <p className="text-sm text-navy-500">View all Bill of Quantities items across all requisitions</p>
      </div>

      {/* Filters */}
      <Card className="border-navy-200">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
              <Input
                placeholder="Search item name, description, category..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                className="pl-10"
              />
            </div>
            <Input
              placeholder="Min Price"
              type="number"
              value={priceFrom}
              onChange={e => { setPriceFrom(e.target.value); setPage(1) }}
              className="w-full sm:w-[130px]"
              min={0}
            />
            <Input
              placeholder="Max Price"
              type="number"
              value={priceTo}
              onChange={e => { setPriceTo(e.target.value); setPage(1) }}
              className="w-full sm:w-[130px]"
              min={0}
            />
            <Select value={categoryFilter} onValueChange={v => { setCategoryFilter(v === '_all' ? '' : v); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-navy-200">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-navy-50 hover:bg-navy-50">
                  <TableHead>Item Name</TableHead>
                  <TableHead className="hidden md:table-cell">Requisition</TableHead>
                  <TableHead className="hidden lg:table-cell">Site</TableHead>
                  <TableHead className="hidden sm:table-cell">Category</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="hidden sm:table-cell">Unit</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boqItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-navy-400">
                      <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      <p>No BOQ items found</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  boqItems.map(item => (
                    <TableRow key={item.id} className="cursor-pointer hover:bg-navy-50/50">
                      <TableCell>
                        <div>
                          <p className="font-medium text-navy-900">{item.itemName}</p>
                          <p className="text-xs text-navy-400 md:hidden">{item.requisition?.title}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-navy-600 max-w-[180px] truncate">
                        {item.requisition?.title}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {item.requisition?.site?.name}
                        {item.requisition?.site?.client && (
                          <span className="text-navy-400 ml-1 text-xs">({item.requisition.site.client.name})</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {item.category ? (
                          <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                        ) : (
                          <span className="text-navy-300 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{item.unit}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(item.totalPrice)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openView(item)}>
                          <Eye className="w-4 h-4 text-navy-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-navy-100">
              <p className="text-sm text-navy-500">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline" size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={showView} onOpenChange={setShowView}>
        <DialogContent className="max-w-lg">
          {viewItem && (
            <>
              <DialogHeader>
                <DialogTitle className="text-navy-900">{viewItem.itemName}</DialogTitle>
                <DialogDescription>BOQ Item Details</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide">Category</p>
                    <p className="font-medium">{viewItem.category || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide">Unit</p>
                    <p className="font-medium">{viewItem.unit}</p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide">Quantity</p>
                    <p className="font-medium">{viewItem.quantity}</p>
                  </div>
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide">Unit Price</p>
                    <p className="font-medium">{formatCurrency(viewItem.unitPrice)}</p>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <div className="flex justify-between">
                    <p className="text-sm text-navy-500">Total Price</p>
                    <p className="text-lg font-bold text-navy-900">{formatCurrency(viewItem.totalPrice)}</p>
                  </div>
                </div>

                {viewItem.description && (
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide mb-1">Description</p>
                    <p className="text-sm">{viewItem.description}</p>
                  </div>
                )}

                {viewItem.notes && (
                  <div>
                    <p className="text-xs text-navy-500 uppercase tracking-wide mb-1">Notes</p>
                    <p className="text-sm">{viewItem.notes}</p>
                  </div>
                )}

                <div className="border-t pt-3">
                  <p className="text-xs text-navy-500 uppercase tracking-wide mb-2">Requisition</p>
                  <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
                    <p className="font-medium">{viewItem.requisition?.title}</p>
                    <p className="text-navy-500">Site: {viewItem.requisition?.site?.name}</p>
                    {viewItem.requisition?.site?.client && (
                      <p className="text-navy-500">Client: {viewItem.requisition.site.client.name}</p>
                    )}
                    <p className="text-navy-500">Requested by: {viewItem.requisition?.user?.name}</p>
                  </div>
                </div>

                <div className="flex justify-between text-xs text-navy-400 pt-2">
                  <span>Created: {formatDateTime(viewItem.createdAt)}</span>
                  <span>Updated: {formatDateTime(viewItem.updatedAt)}</span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
