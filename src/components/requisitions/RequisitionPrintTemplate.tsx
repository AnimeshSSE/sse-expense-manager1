'use client'

import { useQuery } from '@tanstack/react-query'
import { useAppStore, formatCurrency, type Requisition } from '@/lib/store'
import { authGet } from '@/lib/fetch'
import { format } from 'date-fns'
import { StatusBadge } from '@/components/shared/StatusBadge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

const urgencyConfig: Record<string, { label: string; className: string }> = {
  LOW: { label: 'Low', className: 'bg-gray-100 text-gray-700' },
  NORMAL: { label: 'Normal', className: 'bg-gray-100 text-gray-700' },
  MEDIUM: { label: 'Medium', className: 'bg-amber-100 text-amber-700' },
  HIGH: { label: 'High', className: 'bg-red-100 text-red-700' },
}

export function RequisitionPrintTemplate() {
  const { selectedRequisitionId, isPrintMode } = useAppStore()

  const { data } = useQuery<{ requisition: Requisition }>({
    queryKey: ['requisition', selectedRequisitionId],
    queryFn: () => authGet(`/api/requisitions/${selectedRequisitionId}`),
    enabled: !!selectedRequisitionId,
  })

  const requisition = data?.requisition

  if (!requisition) return null

  if (!isPrintMode) {
    return (
      <div className="print-only">
        <RequisitionPrintContent requisition={requisition} />
      </div>
    )
  }

  return <RequisitionPrintContent requisition={requisition} />
}

function RequisitionPrintContent({ requisition }: { requisition: Record<string, unknown> }) {
  const items = (requisition.items || []) as Array<Record<string, unknown>>
  const user = requisition.user as Record<string, unknown> | null

  return (
    <div className="bg-white text-black p-8 max-w-[210mm] mx-auto min-h-[297mm]">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-lg bg-primary flex items-center justify-center"><span className="text-primary-foreground font-bold text-lg">SSE</span></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SSE Purchase Requisition</h1>
            <p className="text-sm text-gray-500">Company Confidential</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Date: {format(new Date(), 'MMMM d, yyyy')}</p>
          <p className="text-sm text-gray-500">PR ID: {(requisition.id as string).toUpperCase()}</p>
        </div>
      </div>

      <Separator className="bg-gray-300 mb-8" />

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Title</p>
            <p className="text-lg font-semibold">{requisition.title as string}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Description</p>
            <p className="text-sm">{(requisition.description as string) || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Requested By</p>
            <p className="text-sm">{(user?.name as string) || 'Unknown'} ({(user?.department as string) || ''})</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Status</p>
            <div className="mt-1"><StatusBadge status={requisition.status as string} /></div>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Vendor</p>
            <p className="text-sm font-medium">{(requisition.vendorName as string) || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Delivery Date</p>
            <p className="text-sm">{requisition.deliveryDate ? format(new Date(requisition.deliveryDate as string), 'MMMM d, yyyy') : '-'}</p>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Items</h2>
        <Table>
          <TableHeader>
            <TableRow className="border-gray-300 hover:bg-transparent">
              <TableHead className="text-gray-700 font-semibold">#</TableHead>
              <TableHead className="text-gray-700 font-semibold">Description</TableHead>
              <TableHead className="text-gray-700 font-semibold">Code</TableHead>
              <TableHead className="text-gray-700 font-semibold text-center">Qty</TableHead>
              <TableHead className="text-gray-700 font-semibold text-right">Unit Price</TableHead>
              <TableHead className="text-gray-700 font-semibold text-right">Total</TableHead>
              <TableHead className="text-gray-700 font-semibold">Urgency</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, idx) => {
              const config = urgencyConfig[(item.urgency as string)] || urgencyConfig.NORMAL
              return (
                <TableRow key={item.id as string} className="border-gray-200 hover:bg-transparent">
                  <TableCell className="text-gray-600">{idx + 1}</TableCell>
                  <TableCell className="font-medium text-gray-900">{item.description as string}</TableCell>
                  <TableCell className="text-gray-600 font-mono text-xs">{(item.itemCode as string) || '-'}</TableCell>
                  <TableCell className="text-center">{item.quantity as number}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.unitPrice as number)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(item.totalAmount as number)}</TableCell>
                  <TableCell><Badge className={config.className}>{config.label}</Badge></TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <Separator className="bg-gray-300 mt-4" />
        <div className="flex justify-end mt-4">
          <div className="text-right">
            <p className="text-sm text-gray-500">Total Amount</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(requisition.totalAmount as number)}</p>
          </div>
        </div>
      </div>

      <div className="mt-12 pt-8 border-t border-gray-300">
        <h2 className="text-lg font-semibold mb-6">Approval Section</h2>
        <div className="grid grid-cols-3 gap-8">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Requested By</p>
            <div className="border-b border-gray-400 pb-1 mb-8"><p className="text-xs text-gray-400">{user?.name as string || ''}</p></div>
            <p className="text-xs text-gray-400">Date: _______________</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Approved By</p>
            <div className="border-b border-gray-400 pb-1 mb-8"><p className="text-xs text-gray-400">&nbsp;</p></div>
            <p className="text-xs text-gray-400">Date: _______________</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Procurement Review</p>
            <div className="border-b border-gray-400 pb-1 mb-8"><p className="text-xs text-gray-400">&nbsp;</p></div>
            <p className="text-xs text-gray-400">Date: _______________</p>
          </div>
        </div>
      </div>

      <div className="mt-12 pt-4 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-400">
          This document is confidential and intended for internal use only.
          SSE Procurement Management System &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
