'use client'

import { useQuery } from '@tanstack/react-query'
import { authGet } from '@/lib/fetch'
import { useAppStore, formatCurrency, type Expense } from '@/lib/store'
import { format } from 'date-fns'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'

export function ExpensePrintTemplate() {
  const { selectedExpenseId, isPrintMode } = useAppStore()

  const { data } = useQuery<{ expense: Expense }>({
    queryKey: ['expense', selectedExpenseId],
    queryFn: () => authGet(`/api/expenses/${selectedExpenseId}`),
    enabled: !!selectedExpenseId,
  })

  const expense = data?.expense

  if (!expense) return null

  const getCategoryName = (cat: unknown) => {
    if (typeof cat === 'string') return cat
    if (typeof cat === 'object' && cat !== null && 'name' in cat) return (cat as { name: string }).name
    return 'Unknown'
  }

  if (!isPrintMode) {
    return (
      <div className="print-only">
        <ExpensePrintContent expense={expense} getCategoryName={getCategoryName} />
      </div>
    )
  }

  return <ExpensePrintContent expense={expense} getCategoryName={getCategoryName} />
}

function ExpensePrintContent({ expense, getCategoryName }: { expense: Record<string, unknown>; getCategoryName: (cat: unknown) => string }) {
  const items = (expense.items || []) as Array<Record<string, unknown>>
  const user = expense.user as Record<string, unknown> | null

  return (
    <div className="bg-white text-black p-8 max-w-[210mm] mx-auto min-h-[297mm]">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-lg bg-primary flex items-center justify-center"><span className="text-primary-foreground font-bold text-lg">SSE</span></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SSE Expense Report</h1>
            <p className="text-sm text-gray-500">Company Confidential</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">
            Report Date: {format(new Date(), 'MMMM d, yyyy')}
          </p>
          <p className="text-sm text-gray-500">
            Report ID: {(expense.id as string).toUpperCase()}
          </p>
        </div>
      </div>

      <Separator className="bg-gray-300 mb-8" />

      {/* Expense Info */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Expense Title</p>
            <p className="text-lg font-semibold">{expense.title as string}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Description</p>
            <p className="text-sm">{(expense.description as string) || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Department</p>
            <p className="text-sm">{(expense.department as string) || '-'}</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Status</p>
            <div className="mt-1">
              <StatusBadge status={expense.status as string} />
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Submitted By</p>
            <p className="text-sm">{(user?.name as string) || 'Unknown'} ({(user?.department as string) || ''})</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Created Date</p>
            <p className="text-sm">{format(new Date(expense.createdAt as string), 'MMMM d, yyyy')}</p>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Expense Items</h2>
        <Table>
          <TableHeader>
            <TableRow className="border-gray-300 hover:bg-transparent">
              <TableHead className="text-gray-700 font-semibold">#</TableHead>
              <TableHead className="text-gray-700 font-semibold">Description</TableHead>
              <TableHead className="text-gray-700 font-semibold">Category</TableHead>
              <TableHead className="text-gray-700 font-semibold">Date</TableHead>
              <TableHead className="text-gray-700 font-semibold text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, idx) => (
              <TableRow key={item.id as string} className="border-gray-200 hover:bg-transparent">
                <TableCell className="text-gray-600">{idx + 1}</TableCell>
                <TableCell className="font-medium text-gray-900">{item.description as string}</TableCell>
                <TableCell className="text-gray-600">{getCategoryName(item.category)}</TableCell>
                <TableCell className="text-gray-600">
                  {format(new Date(item.date as string), 'MMM d, yyyy')}
                </TableCell>
                <TableCell className="text-right font-medium text-gray-900">
                  {formatCurrency(item.amount as number)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Separator className="bg-gray-300 mt-4" />
        <div className="flex justify-end mt-4">
          <div className="text-right">
            <p className="text-sm text-gray-500">Total Amount</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(expense.totalAmount as number)}
            </p>
          </div>
        </div>
      </div>

      {/* Approval Section */}
      <div className="mt-12 pt-8 border-t border-gray-300">
        <h2 className="text-lg font-semibold mb-6">Approval Section</h2>
        <div className="grid grid-cols-3 gap-8">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Prepared By</p>
            <div className="border-b border-gray-400 pb-1 mb-8">
              <p className="text-xs text-gray-400">{user?.name as string || ''}</p>
            </div>
            <p className="text-xs text-gray-400">Date: _______________</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Approved By</p>
            <div className="border-b border-gray-400 pb-1 mb-8">
              <p className="text-xs text-gray-400">&nbsp;</p>
            </div>
            <p className="text-xs text-gray-400">Date: _______________</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Finance Review</p>
            <div className="border-b border-gray-400 pb-1 mb-8">
              <p className="text-xs text-gray-400">&nbsp;</p>
            </div>
            <p className="text-xs text-gray-400">Date: _______________</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 pt-4 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-400">
          This document is confidential and intended for internal use only.
          SSE Expense Management System &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
