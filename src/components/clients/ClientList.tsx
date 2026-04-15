'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/lib/store'
import { DataTable, type Column } from '@/components/shared/DataTable'
import { GenericBulkUploadDialog } from '@/components/shared/GenericBulkUploadDialog'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Upload, Edit, Trash2 } from 'lucide-react'
import { ClientForm, type ClientData } from './ClientForm'
import { toast } from 'sonner'

export function ClientList() {
  const { currentUser } = useAppStore()
  const queryClient = useQueryClient()
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [showClientForm, setShowClientForm] = useState(false)
  const [editingClient, setEditingClient] = useState<ClientData | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const isAdmin = currentUser?.role === 'ADMIN'

  const { data, isLoading, error } = useQuery({
    queryKey: ['clients'],
    queryFn: () => fetch('/api/clients?limit=100').then(res => res.json()),
    enabled: isAdmin,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/clients?id=${id}`, { method: 'DELETE' }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client deleted successfully')
      setDeleteId(null)
    },
    onError: () => toast.error('Failed to delete client'),
  })

  const clients: ClientData[] = data?.clients || []

  const columns: Column<ClientData>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (item) => (
        <span className="font-medium text-sm">{item.name}</span>
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
      key: 'email',
      header: 'Email',
      render: (item) => (
        <span className="text-sm text-muted-foreground">{item.email || '-'}</span>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (item) => (
        <span className="text-sm text-muted-foreground">{item.phone || '-'}</span>
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

  const handleAddClient = () => {
    setEditingClient(null)
    setShowClientForm(true)
  }

  const handleEditClient = (client: ClientData) => {
    setEditingClient(client)
    setShowClientForm(true)
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
        <p className="text-muted-foreground">Failed to load clients.</p>
        <button onClick={() => queryClient.invalidateQueries({ queryKey: ['clients'] })} className="text-primary hover:underline">Retry</button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground">Manage client organizations</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowBulkUpload(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Bulk Upload
          </Button>
          <Button onClick={handleAddClient} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Client
          </Button>
        </div>
      </div>

      <DataTable<ClientData>
        tableName="clients"
        columns={columns}
        data={clients}
        searchPlaceholder="Search clients..."
        actions={(item) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => { e.stopPropagation(); handleEditClient(item) }}
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
        entity="clients"
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['clients'] })}
      />

      <ClientForm
        open={showClientForm}
        onOpenChange={setShowClientForm}
        client={editingClient}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Delete Client"
        description="Are you sure you want to delete this client? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  )
}
