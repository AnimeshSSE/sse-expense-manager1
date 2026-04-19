'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useLanguage } from '@/hooks/use-language'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, MoreHorizontal, Pencil, Trash2, MapPin } from 'lucide-react'
import { toast } from 'sonner'

interface Site {
  id: string
  name: string
  clientId: string
  location: string | null
  description: string | null
  budget: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  client: { id: string; name: string }
  _count: { expenses: number; requisitions: number; advances: number }
  totalSpent: number
  remaining: number
}

interface ClientOption {
  id: string
  name: string
  isActive: boolean
}

interface SiteFormData {
  name: string
  clientId: string
  location: string
  description: string
  budget: string
  isActive: boolean
}

const emptyForm: SiteFormData = { name: '', clientId: '', location: '', description: '', budget: '0', isActive: true }

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

function BudgetProgress({ spent, budget }: { spent: number; budget: number }) {
  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : spent > 0 ? 100 : 0
  const isOver = spent > budget && budget > 0
  const color = isOver
    ? 'bg-red-500'
    : pct > 80
      ? 'bg-amber-500'
      : pct > 50
        ? 'bg-blue-500'
        : 'bg-emerald-500'

  return (
    <div className="space-y-1">
      <div className="w-full bg-navy-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-navy-400">
        <span>{formatCurrency(spent)} spent</span>
        {budget > 0 && <span>{pct.toFixed(0)}%</span>}
      </div>
    </div>
  )
}

export function SitesPage() {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [filterClient, setFilterClient] = useState<string>('')
  const [filterActive, setFilterActive] = useState<string>('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [deletingSite, setDeletingSite] = useState<Site | null>(null)
  const [form, setForm] = useState<SiteFormData>(emptyForm)

  // Sites list query
  const params: Record<string, string> = { page: String(page), pageSize: '20' }
  if (search) params.search = search
  if (filterClient) params.clientId = filterClient
  if (filterActive) params.isActive = filterActive

  const { data, isLoading } = useQuery({
    queryKey: ['sites', page, search, filterClient, filterActive],
    queryFn: () => api.getSites(params) as Promise<{ data: Site[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>,
  })

  // Clients for dropdown (all active + the current client if editing)
  const { data: clientsData } = useQuery({
    queryKey: ['clients-all-active'],
    queryFn: () => api.getClients({ isActive: 'true', pageSize: '100' }) as Promise<{ data: ClientOption[] }>,
  })

  const clients = clientsData?.data || []

  const createMutation = useMutation({
    mutationFn: (data: SiteFormData) => api.createSite({ ...data, budget: parseFloat(data.budget) || 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      toast.success('Site created successfully')
      closeDialog()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: SiteFormData }) => api.updateSite(id, { ...data, budget: parseFloat(data.budget) || 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      toast.success('Site updated successfully')
      closeDialog()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteSite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      toast.success('Site deleted successfully')
      setDeleteOpen(false)
      setDeletingSite(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const openCreate = () => {
    setEditingSite(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (site: Site) => {
    setEditingSite(site)
    setForm({
      name: site.name,
      clientId: site.clientId,
      location: site.location || '',
      description: site.description || '',
      budget: String(site.budget),
      isActive: site.isActive,
    })
    setDialogOpen(true)
  }

  const openDelete = (site: Site) => {
    setDeletingSite(site)
    setDeleteOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingSite(null)
    setForm(emptyForm)
  }

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error('Site name is required')
      return
    }
    if (!form.clientId) {
      toast.error('Client is required')
      return
    }
    if (editingSite) {
      updateMutation.mutate({ id: editingSite.id, data: form })
    } else {
      createMutation.mutate(form)
    }
  }

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(1)
  }

  const hasRelations = (site: Site) =>
    site._count.expenses > 0 || site._count.requisitions > 0 || site._count.advances > 0

  const pagination = data?.pagination

  // Get unique clients from data for filter dropdown
  const uniqueClients = data?.data
    ? Array.from(new Map(data.data.map(s => [s.client.id, { id: s.client.id, name: s.client.name }])).values())
    : []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-navy-700" />
          <h2 className="text-lg font-semibold text-navy-900">Sites</h2>
          {pagination && (
            <Badge variant="secondary" className="text-xs">
              {pagination.total} total
            </Badge>
          )}
        </div>
        <Button onClick={openCreate} className="bg-amber-500 hover:bg-amber-600 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Add Site
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-navy-100 p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex gap-2">
          <Input
            placeholder="Search sites, locations, clients..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="max-w-xs"
          />
          <Button variant="outline" onClick={handleSearch} size="default">
            Search
          </Button>
          {(search || filterClient || filterActive) && (
            <Button
              variant="ghost"
              onClick={() => { setSearch(''); setSearchInput(''); setFilterClient(''); setFilterActive(''); setPage(1) }}
            >
              Clear
            </Button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={filterClient} onValueChange={v => { setFilterClient(v); setPage(1) }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_clients">All Clients</SelectItem>
              {uniqueClients.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {['', 'true', 'false'].map(val => (
            <Button
              key={val}
              variant={filterActive === val ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setFilterActive(val); setPage(1) }}
              className={filterActive === val ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}
            >
              {val === '' ? 'All' : val === 'true' ? 'Active' : 'Inactive'}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-navy-100 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-navy-50/50 hover:bg-navy-50/50">
                <TableHead className="font-semibold text-navy-700">Name</TableHead>
                <TableHead className="font-semibold text-navy-700">Client</TableHead>
                <TableHead className="font-semibold text-navy-700">Location</TableHead>
                <TableHead className="font-semibold text-navy-700 text-right">Budget</TableHead>
                <TableHead className="font-semibold text-navy-700 min-w-[180px]">Spent</TableHead>
                <TableHead className="font-semibold text-navy-700 text-right">Remaining</TableHead>
                <TableHead className="font-semibold text-navy-700">Status</TableHead>
                <TableHead className="font-semibold text-navy-700 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : !data?.data?.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-navy-400">
                    {t.noData}
                  </TableCell>
                </TableRow>
              ) : (
                data.data.map(site => {
                  const isOverBudget = site.totalSpent > site.budget && site.budget > 0
                  return (
                    <TableRow key={site.id} className="hover:bg-navy-50/30">
                      <TableCell className="font-medium text-navy-900">{site.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-navy-600 border-navy-200">
                          {site.client.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-navy-500">{site.location || '—'}</TableCell>
                      <TableCell className="text-right text-navy-700 font-medium">
                        {formatCurrency(site.budget)}
                      </TableCell>
                      <TableCell>
                        <BudgetProgress spent={site.totalSpent} budget={site.budget} />
                      </TableCell>
                      <TableCell className={`text-right font-medium ${isOverBudget ? 'text-red-600' : 'text-navy-700'}`}>
                        {formatCurrency(site.remaining)}
                        {isOverBudget && (
                          <span className="block text-[10px] text-red-500">Over budget</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={site.isActive
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-red-100 text-red-700 hover:bg-red-100'
                        }>
                          {site.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(site)} className="cursor-pointer">
                              <Pencil className="w-4 h-4 mr-2" />
                              {t.edit}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openDelete(site)}
                              disabled={hasRelations(site)}
                              className="cursor-pointer text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              {t.delete}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-navy-100">
            <p className="text-sm text-navy-500">
              Showing {((pagination.page - 1) * pagination.pageSize) + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </Button>
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === pagination.totalPages || Math.abs(p - pagination.page) <= 1)
                .map((p, i, arr) => (
                  <span key={p} className="flex items-center">
                    {i > 0 && arr[i - 1] !== p - 1 && <span className="px-1 text-navy-400">...</span>}
                    <Button
                      variant={p === pagination.page ? 'default' : 'outline'}
                      size="sm"
                      className={p === pagination.page ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  </span>
                ))}
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) closeDialog(); else setDialogOpen(true) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-navy-900">
              {editingSite ? 'Edit Site' : 'Add Site'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="site-name">Name <span className="text-red-500">*</span></Label>
              <Input
                id="site-name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Site name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-client">Client <span className="text-red-500">*</span></Label>
              <Select value={form.clientId} onValueChange={v => setForm(f => ({ ...f, clientId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="site-location">Location</Label>
                <Input
                  id="site-location"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="Site location"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-budget">Budget (₹)</Label>
                <Input
                  id="site-budget"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.budget}
                  onChange={e => setForm(f => ({ ...f, budget: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-desc">Description</Label>
              <Textarea
                id="site-desc"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional description"
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-navy-100 p-3">
              <div>
                <Label htmlFor="site-active" className="text-sm font-medium text-navy-900">Active</Label>
                <p className="text-xs text-navy-500">Inactive sites won't appear in dropdowns</p>
              </div>
              <Switch
                id="site-active"
                checked={form.isActive}
                onCheckedChange={checked => setForm(f => ({ ...f, isActive: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              {t.cancel}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Site</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingSite?.name}</strong>? This action cannot be undone.
              {deletingSite && hasRelations(deletingSite) && (
                <span className="block mt-2 text-red-600 font-medium">
                  This site has related records (expenses/requisitions/advances). Please delete them first.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingSite && deleteMutation.mutate(deletingSite.id)}
              disabled={deleteMutation.isPending || (deletingSite ? hasRelations(deletingSite) : false)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? 'Deleting...' : t.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
