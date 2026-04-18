'use client'

import { useQuery } from '@tanstack/react-query'
import { authGet } from '@/lib/fetch'
import { useAppStore, formatCurrency } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/shared/StatusBadge'
import {
  DollarSign,
  Clock,
  ClipboardList,
  Wallet,
  Receipt,
  TrendingUp,
  Activity,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { format } from 'date-fns'

const PIE_COLORS = ['#059669', '#0891b2', '#ca8a04', '#dc2626', '#7c3aed', '#db2777', '#ea580c', '#4f46e5']

interface DashboardData {
  summary: { totalExpenseAmount: number; totalRequisitionAmount: number; totalAdvanceAmount: number }
  expenseByStatus: { status: string; _sum: { totalAmount: number | null }; _count: number }[]
  requisitionByStatus: { status: string; _sum: { totalAmount: number | null }; _count: number }[]
  advanceByStatus: { status: string; _sum: { amount: number | null }; _count: number }[]
  monthlyExpenseTrend: { month: string; total: number; count: number }[]
  departmentBreakdown: { department: string | null; userCount: number; totalExpenseAmount: number; expenseCount: number }[]
  recentActivity: { id: string; type: 'EXPENSE' | 'REQUISITION' | 'ADVANCE'; title: string; status: string; amount: number; updatedAt: string; userName: string }[]
}

export function Dashboard() {
  const { currentUser, setCurrentPage } = useAppStore()
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => authGet('/api/dashboard'),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-6 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[400px] w-full rounded-xl" />
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <p className="text-muted-foreground">Failed to load dashboard data.</p>
        <button onClick={() => window.location.reload()} className="text-primary hover:underline">
          Retry
        </button>
      </div>
    )
  }

  const { summary, expenseByStatus, requisitionByStatus, advanceByStatus, monthlyExpenseTrend, departmentBreakdown, recentActivity } = data || {}

  // Calculate stats
  const totalExpenses = summary?.totalExpenseAmount || 0
  const pendingApprovals = [
    ...(expenseByStatus?.filter((s: { status: string }) => s.status === 'SUBMITTED') || []),
    ...(requisitionByStatus?.filter((s: { status: string }) => s.status === 'SUBMITTED') || []),
    ...(advanceByStatus?.filter((s: { status: string }) => s.status === 'SUBMITTED') || []),
  ].reduce((sum: number, s: { _count: number }) => sum + s._count, 0)
  const openRequisitions = [
    ...(requisitionByStatus?.filter((s: { status: string }) => s.status === 'DRAFT') || []),
    ...(requisitionByStatus?.filter((s: { status: string }) => s.status === 'SUBMITTED') || []),
  ].reduce((sum: number, s: { _count: number }) => sum + s._count, 0)
  const activeAdvances = [
    ...(advanceByStatus?.filter((s: { status: string }) => s.status === 'DISBURSED') || []),
    ...(advanceByStatus?.filter((s: { status: string }) => s.status === 'APPROVED') || []),
  ].reduce((sum: number, s: { _count: number }) => sum + s._count, 0)

  // Monthly trend for chart
  const chartData = (monthlyExpenseTrend || []).map((item: { month: string; total: number }) => ({
    month: format(new Date(item.month + '-01'), 'MMM'),
    expenses: item.total,
  }))

  // Department breakdown for pie chart
  const pieData = (departmentBreakdown || []).map((item: { department: string; totalExpenseAmount: number }) => ({
    name: item.department,
    value: item.totalExpenseAmount,
  }))

  const statCards = [
    {
      title: 'Total Expenses',
      value: formatCurrency(totalExpenses),
      icon: DollarSign,
    },
    {
      title: 'Pending Approvals',
      value: pendingApprovals.toString(),
      icon: Clock,
      description: 'Awaiting your review',
    },
    {
      title: 'Open Requisitions',
      value: openRequisitions.toString(),
      icon: ClipboardList,
    },
    {
      title: 'Active Advances',
      value: activeAdvances.toString(),
      icon: Wallet,
      description: 'Outstanding advances',
    },
  ]

  const formatChartCurrency = (val: number) => `₹${val.toLocaleString()}`

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {currentUser?.name}. Here&apos;s your expense overview.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription className="text-sm font-medium">
                  {stat.title}
                </CardDescription>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <div className="text-2xl font-bold">{stat.value}</div>
                </div>
                {stat.description && (
                  <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Monthly Expense Trend
            </CardTitle>
            <CardDescription>Expense data by month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.395 0.12 155)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="oklch(0.395 0.12 155)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs" tick={{ fill: 'var(--muted-foreground)' }} />
                    <YAxis className="text-xs" tick={{ fill: 'var(--muted-foreground)' }} tickFormatter={formatChartCurrency} />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Expenses']}
                      contentStyle={{
                        backgroundColor: 'var(--popover)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--popover-foreground)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="expenses"
                      stroke="oklch(0.395 0.12 155)"
                      strokeWidth={2}
                      fill="url(#colorExpenses)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No expense data yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Department Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Department Breakdown
            </CardTitle>
            <CardDescription>Expense distribution by department</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                      labelLine={false}
                    >
                      {pieData.map((_: unknown, index: number) => (
                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: 'var(--popover)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--popover-foreground)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No department data yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest updates across all modules</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
            {(!recentActivity || recentActivity.length === 0) ? (
              <p className="text-center text-muted-foreground py-8">No recent activity</p>
            ) : (
              recentActivity.map((activity: { id: string; type: string; title: string; status: string; amount: number; updatedAt: string; userName: string }) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setCurrentPage(activity.type === 'EXPENSE' ? 'expenses' : activity.type === 'REQUISITION' ? 'requisitions' : 'advances')}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 ${
                      activity.type === 'EXPENSE' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                      activity.type === 'REQUISITION' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                    }`}>
                      {activity.type === 'EXPENSE' ? <DollarSign className="h-4 w-4" /> :
                       activity.type === 'REQUISITION' ? <ClipboardList className="h-4 w-4" /> :
                       <Wallet className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.userName} · {format(new Date(activity.updatedAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status={activity.status} />
                    <span className="text-sm font-medium">
                      {formatCurrency(activity.amount)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => {
            useAppStore.getState().setExpenseFormMode('create')
            useAppStore.getState().setSelectedExpenseId(null)
            setCurrentPage('expenses')
          }}
        >
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">New Expense</p>
              <p className="text-xs text-muted-foreground">Create expense report</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => {
            useAppStore.getState().setRequisitionFormMode('create')
            useAppStore.getState().setSelectedRequisitionId(null)
            setCurrentPage('requisitions')
          }}
        >
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">New Requisition</p>
              <p className="text-xs text-muted-foreground">Submit purchase request</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => {
            useAppStore.getState().setAdvanceFormMode('create')
            useAppStore.getState().setSelectedAdvanceId(null)
            setCurrentPage('advances')
          }}
        >
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">New Advance</p>
              <p className="text-xs text-muted-foreground">Request cash advance</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
