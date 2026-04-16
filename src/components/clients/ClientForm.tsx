'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { authPost, authPut } from '@/lib/fetch'

export interface ClientData {
  id: string
  name: string
  code: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  status: 'ACTIVE' | 'INACTIVE'
}

interface ClientFormInnerProps {
  client: ClientData | null
  onClose: () => void
}

function ClientFormInner({ client, onClose }: ClientFormInnerProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(client?.name ?? '')
  const [code, setCode] = useState(client?.code ?? '')
  const [email, setEmail] = useState(client?.email ?? '')
  const [phone, setPhone] = useState(client?.phone ?? '')
  const [address, setAddress] = useState(client?.address ?? '')
  const [city, setCity] = useState(client?.city ?? '')
  const [state, setState] = useState(client?.state ?? '')

  const isEdit = !!client

  const createMutation = useMutation({
    mutationFn: (body: object) => authPost('/api/clients', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client created successfully')
      onClose()
    },
    onError: () => toast.error('Failed to create client'),
  })

  const updateMutation = useMutation({
    mutationFn: (body: object) => authPut('/api/clients', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client updated successfully')
      onClose()
    },
    onError: () => toast.error('Failed to update client'),
  })

  const handleSubmit = () => {
    if (!name.trim() || !code.trim()) {
      toast.error('Name and code are required')
      return
    }

    const body = { name, code, email, phone, address, city, state }

    if (isEdit && client?.id) {
      updateMutation.mutate({ ...body, id: client.id })
    } else {
      createMutation.mutate(body)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{isEdit ? 'Edit Client' : 'Add New Client'}</DialogTitle>
        <DialogDescription>
          {isEdit ? 'Update client information' : 'Fill in the new client details'}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="client-name">Client Name *</Label>
          <Input id="client-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Corp" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-code">Client Code *</Label>
          <Input id="client-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. ACME" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="client-email">Email</Label>
            <Input id="client-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@acme.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-phone">Phone</Label>
            <Input id="client-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 9876543210" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="client-address">Address</Label>
          <Input id="client-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Business Park" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="client-city">City</Label>
            <Input id="client-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Mumbai" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="client-state">State</Label>
            <Input id="client-state" value={state} onChange={(e) => setState(e.target.value)} placeholder="Maharashtra" />
          </div>
        </div>
      </div>

      <DialogFooter className="flex-col sm:flex-row gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {isEdit ? 'Save Changes' : 'Create Client'}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

interface ClientFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: ClientData | null
}

export function ClientForm({ open, onOpenChange, client }: ClientFormProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <ClientFormInner
          key={client?.id ?? 'new'}
          client={client}
          onClose={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  )
}
