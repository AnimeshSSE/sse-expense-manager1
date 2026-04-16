'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/lib/store'
import { authGet, authDelete } from '@/lib/fetch'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { GenericBulkUploadDialog } from '@/components/shared/GenericBulkUploadDialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Upload, Edit, Trash2 } from 'lucide-react'
import { SiteForm, type SiteData } from './SiteForm'
import { toast } from 'sonner'

export function SiteList() {
  const { currentUser } = useAppStore()
  const queryClient = useQueryClient()
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [showSiteForm, setShowSiteForm] = useState(false)
  const [editingSite, setEditingSite] = useState<SiteData | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const isAdmin = currentUser?.role === 'ADMIN'

  const { data, isLoading, error } = useQuery({
    queryKey: ['sites'],
    queryFn: () => authGet('/api/sites?limit=100'),
    enabled: isAdmin,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => authDelete(`/api/sites?id=${id}`).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      toast.success('Site deleted successfully')
      setDeleteId(null)
    },
    onError: () => toast.error('Failed to delete site'),
  })

  const sites: SiteData[] = data?.sites || []

  const columns: Column<SiteData>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (item) => (
        <div>
          <span className="font-medium text-sm">{item.name}</span>
          {item.address && (
            <p className="text-xs text-muted-foreground max-w-[200px] truncate">{item.address}</p>
          )}
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      render: (item) => (
        <span className="text-sm font-mono text-muted-foreground">{item.code}</span>
      ),
    },
    {
      key: 'city',
      header: 'City',
      render: (item) => (
        <span className="text-sm">{item.city || '-'}</span>
      ),
    },
    {
      key: 'state',
      header: 'State',
      render: (item) => (
        <span className="text-sm">{item.state || '-'}</span>
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

  const handleAddSite = () => {
    setEditingSite(null)
    setShowSiteForm(true)
  }

  const handleEditSite = (site: SiteData) => {
    setEditingSite(site)
    setShowSiteForm(true)
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <p className="text-muted-foreground">Access denied. Admin only.</p>
      </div>
    )
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
        <p className="text-muted-foreground">Failed to load sites.</p>
        <button onClick={() => queryClient.invalidateQueries({ queryKey: ['sites'] })} className="text-primary hover:underline">Retry</button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sites</h1>
          <p className="text-muted-foreground">Manage project sites and locations</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowBulkUpload(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Bulk Upload
          </Button>
          <Button onClick={handleAddSite} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Site
          </Button>
        </div>
      </div>

      <DataTable<SiteData>
        tableName="sites"
        columns={columns}
        data={sites}
        searchPlaceholder="Search sites..."
        actions={(item) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => { e.stopPropagation(); handleEditSite(item) }}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); setDeleteId(item.id) }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      />

      <GenericBulkUploadDialog
        open={showBulkUpload}
        onOpenChange={setShowBulkUpload}
        entity="sites"
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['sites'] })}
      />

      <SiteForm
        open={showSiteForm}
        onOpenChange={setShowSiteForm}
        site={editingSite}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Delete Site"
        description="Are you sure you want to delete this site? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}
