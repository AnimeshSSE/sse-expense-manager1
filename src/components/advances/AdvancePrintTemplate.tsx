'use client'

import { useQuery } from '@tanstack/react-query'
import { useAppStore, formatCurrency } from '@/lib/store'
import { authGet } from '@/lib/fetch'
import { format } from 'date-fns'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Separator } from '@/components/ui/separator'

export function AdvancePrintTemplate() {
  const { selectedAdvanceId, isPrintMode } = useAppStore()

  const { data } = useQuery({
    queryKey: ['advance', selectedAdvanceId],
    queryFn: () => authGet(`/api/advances/${selectedAdvanceId}`),
    enabled: !!selectedAdvanceId,
  })

  const advance = data?.advance

  if (!advance) return null

  if (!isPrintMode) {
    return (
      <div className="print-only">
        <AdvancePrintContent advance={advance} />
      </div>
    )
  }

  return <AdvancePrintContent advance={advance} />
}

function AdvancePrintContent({ advance }: { advance: Record<string, unknown> }) {
  const user = advance.user as Record<string, unknown> | null

  return (
    <div className="bg-white text-black p-8 max-w-[210mm] mx-auto min-h-[297mm]">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-lg bg-primary flex items-center justify-center"><span className="text-primary-foreground font-bold text-lg">SSE</span></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SSE Cash Advance Request</h1>
            <p className="text-sm text-gray-500">Company Confidential</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Date: {format(new Date(), 'MMMM d, yyyy')}</p>
          <p className="text-sm text-gray-500">Request ID: {(advance.id as string).toUpperCase()}</p>
        </div>
      </div>

      <Separator className="bg-gray-300 mb-8" />

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Title</p>
            <p className="text-lg font-semibold">{advance.title as string}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Purpose</p>
            <p className="text-sm">{advance.purpose as string}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Requested By</p>
            <p className="text-sm">{(user?.name as string) || 'Unknown'} ({(user?.department as string) || ''})</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Status</p>
            <div className="mt-1"><StatusBadge status={advance.status as string} /></div>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Advance Amount</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(advance.amount as number)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Expected Return Date</p>
            <p className="text-sm">{advance.expectedReturnDate ? format(new Date(advance.expectedReturnDate as string), 'MMMM d, yyyy') : '-'}</p>
          </div>
        </div>
      </div>

      {(advance.settlementDate as string) ? (
        <div className="mb-8 p-4 border border-gray-200 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">Settlement Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Settled Amount</p>
              <p className="text-lg font-semibold">{formatCurrency((advance.settlementAmount as number) || 0)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Settlement Date</p>
              <p className="text-sm">{format(new Date(advance.settlementDate as string), 'MMMM d, yyyy')}</p>
            </div>
          </div>
        </div>
      ) : null}

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
            <p className="text-sm font-medium text-gray-700">Finance / Disbursed By</p>
            <div className="border-b border-gray-400 pb-1 mb-8"><p className="text-xs text-gray-400">&nbsp;</p></div>
            <p className="text-xs text-gray-400">Date: _______________</p>
          </div>
        </div>
      </div>

      <div className="mt-12 pt-4 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-400">
          This document is confidential and intended for internal use only.
          SSE Cash Advance Management System &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
