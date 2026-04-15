'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ExpenseStatus, RequisitionStatus, AdvanceStatus } from '@/lib/store'

type Status = ExpenseStatus | RequisitionStatus | AdvanceStatus

const statusConfig: Record<Status, { label: string; className: string }> = {
  DRAFT: {
    label: 'Draft',
    className: 'bg-secondary text-secondary-foreground border-secondary',
  },
  SUBMITTED: {
    label: 'Submitted',
    className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  },
  APPROVED: {
    label: 'Approved',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  },
  REJECTED: {
    label: 'Rejected',
    className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  },
  PAID: {
    label: 'Paid',
    className: 'bg-primary text-primary-foreground border-primary',
  },
  DISBURSED: {
    label: 'Disbursed',
    className: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
  },
  SETTLED: {
    label: 'Settled',
    className: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800',
  },
  FULFILLED: {
    label: 'Fulfilled',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  },
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status as Status]
  if (!config) {
    return <Badge variant="outline" className={cn('font-medium', className)}>{status}</Badge>
  }

  return (
    <Badge variant="outline" className={cn('font-medium', config.className, className)}>
      {config.label}
    </Badge>
  )
}
