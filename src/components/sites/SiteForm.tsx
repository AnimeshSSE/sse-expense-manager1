'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authPost, authPut } from '@/lib/fetch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export interface SiteData {
  id: string
  name: string
  code: string
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
  status: 'ACTIVE' | 'INACTIVE'
}

interface SiteFormInnerProps {
  site: SiteData | null
  onClose: () => void
}

function SiteFormInner({ site, onClose }: SiteFormInnerProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(site?.name ?? '')
  const [code, setCode] = useState(site?.code ?? '')
  const [address, setAddress] = useState(site?.address ?? '')
  const [city, setCity] = useState(site?.city ?? '')
  const [state, setState] = useState(site?.state ?? '')
  const [pincode, setPincode] = useState(site?.pincode ?? '')

  const isEdit = !!site

  const createMutation = useMutation({
    mutationFn: (body: object) => authPost('/api/sites', body).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      toast.success('Site created successfully')
      onClose()
    },
    onError: () => toast.error('Failed to create site'),
  })

  const updateMutation = useMutation({
    mutationFn: (body: object) => authPut('/api/sites', body).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      toast.success('Site updated successfully')
      onClose()
    },
    onError: () => toast.error('Failed to update site'),
  })

  const handleSubmit = () => {
    if (!name.trim() || !code.trim()) {
      toast.error('Name and code are required')
      return
    }

    const body = { name, code, address, city, state, pincode }

    if (isEdit && site?.id) {
      updateMutation.mutate({ ...body, id: site.id })
    } else {
      createMutation.mutate(body)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit Site' : 'Add New Site'}</DialogTitle>
        <DialogDescription>
          {isEdit ? 'Update site information' : 'Fill in the new site details'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="site-name">Site Name *</Label>
          <Input id="site-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Corporate Office" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="site-code">Site Code *</Label>
          <Input id="site-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. HQ" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="site-address">Address</Label>
          <Input id="site-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main Street" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="site-city">City</Label>
            <Input id="site-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Mumbai" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="site-state">State</Label>
            <Input id="site-state" value={state} onChange={(e) => setState(e.target.value)} placeholder="Maharashtra" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="site-pincode">Pincode</Label>
          <Input id="site-pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="400001" />
        </div>
      </div>

      <DialogFooter className="flex-col sm:flex-row gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {isEdit ? 'Save Changes' : 'Create Site'}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

interface SiteFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  site: SiteData | null
}

export function SiteForm({ open, onOpenChange, site }: SiteFormProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <SiteFormInner
          key={site?.id ?? 'new'}
          site={site}
          onClose={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  )
}
