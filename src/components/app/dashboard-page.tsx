'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
} from 'recharts'
import {
  Receipt, Clock, CheckCircle2, AlertTriangle, IndianRupee,
  TrendingUp, FileText, Users, BarChart3,
} from 'lucide-react'
import { format, parseISO, startOfMonth, subMonths } from 'date-fns'

// ===== Types =====
interface DashboardStats {
  thisMonthExpenses: { total: number; count: number }
  pendingExpenses: { count: number; total: number }
  accountantApprovedExpenses: { count: number; total: number }
  adminApprovedExpenses: { count: number; total: number }
  paidExpenses: { count: number; total: number }
  pendingMirs: { count: number; total: number }
  stockMgrApprovedMirs: { count: number; total: number }
  adminApprovedMirs: { count: number; total: number }
  thisMonthMirs: { count: number; total: number }
}

interface RecentExpense {
  id: string
  amount: number
  description: string
  expenseDate: string
  status: string
  siteName: string
  clientName: string
  categoryName: string
  userName: string
}

interface RecentMir {
  id: string
  title: string
  totalAmount: number
  priority: string
  status: string
  createdAt: string
  siteName: string
  clientName: string
  userName: string
}

interface LateSubmission {
  total: number
  totalAmount: number
  monthlyBreakdown: Array<{ month: string; total: number; count: number }>
  topOffenders: Array<{ userId: string; userName: string; count: number; totalAmount: number }>
  recent: Array<{ id: string; amount: number; description: string; daysLate: number; userName: string; siteName: string; createdAt: string }>
}

interface UserBalance {
  userId: string
  userName: string
  userEmail: string
  userRole: string
  totalExpenses: number
  expenseCount: number
  totalAdvances: number
  advanceCount: number
  balance: number
}

interface Reports {
  byCategory: Array<{ categoryId: string; categoryName: string; total: number; count: number }>
  byMonth: Array<{ month: string; total: number; count: number }>
  bySite: Array<{ siteId: string; siteName: string; clientName: string; total: number; count: number }>
  totalAmount: number
  totalCount: number
}

interface DashboardData {
  stats: DashboardStats
  recentExpenses: RecentExpense[]
  recentMirs: RecentMir[]
  lateSubmissions: LateSubmission
  userBalances: UserBalance[]
  reports: Reports
}

// ===== Helpers =====
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case 'PAID': return 'default' as const
    case 'ADMIN_APPROVED': return 'default' as const
    case 'ACCOUNTANT_APPROVED': return 'secondary' as const
    case 'STOCK_MANAGER_APPROVED': return 'secondary' as const
    case 'PENDING': return 'outline' as const
    case 'REJECTED': return 'destructive' as const
    case 'RETURNED': return 'destructive' as const
    default: return 'outline' as const
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'PAID': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'ADMIN_APPROVED': return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'ACCOUNTANT_APPROVED': return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'STOCK_MANAGER_APPROVED': return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'PENDING': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    case 'REJECTED': return 'bg-red-100 text-red-700 border-red-200'
    case 'RETURNED': return 'bg-orange-100 text-orange-700 border-orange-200'
    case 'ORDERED': return 'bg-indigo-100 text-indigo-700 border-indigo-200'
    case 'RECEIVED': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    default: return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

function formatStatusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const CHART_COLORS = ['#f59e0b', '#102a43', '#334e68', '#627d98', '#9fb3c8', '#bcccdc', '#d9e2ec', '#f0f4f8', '#e11d48', '#059669', '#7c3aed', '#ea580c']

// ===== Sub-Components =====

function StatCard({ title, value, subtitle, icon: Icon, accent, loading }: {
  title: string
  value: string
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  accent?: 'amber' | 'red' | 'green' | 'navy'
  loading?: boolean
}) {
  const accentColors = {
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    navy: 'bg-navy-50 text-navy-700 border-navy-200',
  }

  return (
    <Card className="bg-white rounded-xl border border-navy-100 shadow-sm">
      <CardContent className="p-4 lg:p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-navy-500 truncate">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-28 mt-1" />
            ) : (
              <p className={`text-2xl font-bold mt-1 ${accent === 'amber' ? 'text-amber-600' : accent === 'red' ? 'text-red-600' : accent === 'green' ? 'text-emerald-600' : 'text-navy-900'}`}>
                {value}
              </p>
            )}
            {subtitle && !loading && (
              <p className="text-xs text-navy-400 mt-1">{subtitle}</p>
            )}
            {loading && <Skeleton className="h-3 w-16 mt-2" />}
          </div>
          <div className={`p-2.5 rounded-xl border ${accentColors[accent || 'navy']}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function RecentExpensesTable({ expenses, loading }: { expenses: RecentExpense[]; loading: boolean }) {
  return (
    <Card className="bg-white rounded-xl border border-navy-100 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-navy-900 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-amber-500" />
          Recent Expenses
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="px-6 pb-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : expenses.length === 0 ? (
          <div className="px-6 pb-6 text-sm text-navy-400 text-center py-8">
            No expenses found
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-navy-100 hover:bg-transparent">
                  <TableHead className="text-navy-500 font-medium">Description</TableHead>
                  <TableHead className="text-navy-500 font-medium">Site</TableHead>
                  <TableHead className="text-navy-500 font-medium hidden sm:table-cell">Category</TableHead>
                  <TableHead className="text-navy-500 font-medium">User</TableHead>
                  <TableHead className="text-navy-500 font-medium text-right">Amount</TableHead>
                  <TableHead className="text-navy-500 font-medium">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map(e => (
                  <TableRow key={e.id} className="border-navy-50 hover:bg-navy-50/50">
                    <TableCell className="max-w-[200px] truncate font-medium text-navy-800">{e.description}</TableCell>
                    <TableCell className="text-navy-600 text-sm">{e.siteName}</TableCell>
                    <TableCell className="text-navy-600 text-sm hidden sm:table-cell">{e.categoryName}</TableCell>
                    <TableCell className="text-navy-600 text-sm">{e.userName}</TableCell>
                    <TableCell className="text-right font-semibold text-navy-900">{formatCurrency(e.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(e.status)} className={`text-[10px] font-medium px-2 py-0.5 border ${getStatusColor(e.status)}`}>
                        {formatStatusLabel(e.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RecentMirsTable({ mirs, loading }: { mirs: RecentMir[]; loading: boolean }) {
  return (
    <Card className="bg-white rounded-xl border border-navy-100 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-navy-900 flex items-center gap-2">
          <FileText className="w-4 h-4 text-amber-500" />
          Recent Requisitions
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="px-6 pb-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : mirs.length === 0 ? (
          <div className="px-6 pb-6 text-sm text-navy-400 text-center py-8">
            No requisitions found
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-navy-100 hover:bg-transparent">
                  <TableHead className="text-navy-500 font-medium">Title</TableHead>
                  <TableHead className="text-navy-500 font-medium hidden sm:table-cell">Site</TableHead>
                  <TableHead className="text-navy-500 font-medium">User</TableHead>
                  <TableHead className="text-navy-500 font-medium">Priority</TableHead>
                  <TableHead className="text-navy-500 font-medium text-right">Amount</TableHead>
                  <TableHead className="text-navy-500 font-medium">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mirs.map(m => (
                  <TableRow key={m.id} className="border-navy-50 hover:bg-navy-50/50">
                    <TableCell className="max-w-[200px] truncate font-medium text-navy-800">{m.title}</TableCell>
                    <TableCell className="text-navy-600 text-sm hidden sm:table-cell">{m.siteName}</TableCell>
                    <TableCell className="text-navy-600 text-sm">{m.userName}</TableCell>
                    <TableCell>
                      <Badge variant={m.priority === 'URGENT' ? 'destructive' : 'outline'} className={`text-[10px] font-medium px-2 py-0.5 border ${
                        m.priority === 'URGENT' ? 'bg-red-100 text-red-700 border-red-200' :
                        m.priority === 'HIGH' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                        m.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                        'bg-gray-100 text-gray-600 border-gray-200'
                      }`}>
                        {m.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-navy-900">{formatCurrency(m.totalAmount)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(m.status)} className={`text-[10px] font-medium px-2 py-0.5 border ${getStatusColor(m.status)}`}>
                        {formatStatusLabel(m.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function UserBalancesTable({ balances, loading }: { balances: UserBalance[]; loading: boolean }) {
  return (
    <Card className="bg-white rounded-xl border border-navy-100 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-navy-900 flex items-center gap-2">
          <Users className="w-4 h-4 text-amber-500" />
          User Balances
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="px-6 pb-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : balances.length === 0 ? (
          <div className="px-6 pb-6 text-sm text-navy-400 text-center py-8">
            No balance data available
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-navy-100 hover:bg-transparent">
                  <TableHead className="text-navy-500 font-medium">User</TableHead>
                  <TableHead className="text-navy-500 font-medium text-right">Advances</TableHead>
                  <TableHead className="text-navy-500 font-medium text-right">Expenses</TableHead>
                  <TableHead className="text-navy-500 font-medium text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balances.map(b => (
                  <TableRow key={b.userId} className="border-navy-50 hover:bg-navy-50/50">
                    <TableCell>
                      <div>
                        <p className="font-medium text-navy-800">{b.userName}</p>
                        <p className="text-xs text-navy-400">{b.userRole}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-navy-700">{formatCurrency(b.totalAdvances)}</TableCell>
                    <TableCell className="text-right font-medium text-navy-700">{formatCurrency(b.totalExpenses)}</TableCell>
                    <TableCell className={`text-right font-bold ${b.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(b.balance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MonthlyChart({ data, loading }: { data: Array<{ month: string; total: number; count: number }>; loading: boolean }) {
  const chartData = useMemo(() =>
    data.map(d => ({
      name: d.month,
      amount: d.total,
      count: d.count,
    })),
    [data]
  )

  return (
    <Card className="bg-white rounded-xl border border-navy-100 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-navy-900 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-amber-500" />
          Monthly Expenses
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-navy-400">
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#627d98' }} />
              <YAxis tick={{ fontSize: 11, fill: '#627d98' }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), 'Amount']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #d9e2ec', fontSize: '12px' }}
              />
              <Bar dataKey="amount" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

function CategoryPieChart({ data, loading }: { data: Array<{ categoryName: string; total: number; count: number }>; loading: boolean }) {
  const topCategories = useMemo(() => data.slice(0, 8), [data])
  const otherTotal = useMemo(() => data.slice(8).reduce((s, d) => s + d.total, 0), [data])
  const chartData = useMemo(() => {
    if (otherTotal > 0) {
      return [...topCategories.map(d => ({ name: d.categoryName, value: d.total })), { name: 'Other', value: otherTotal }]
    }
    return topCategories.map(d => ({ name: d.categoryName, value: d.total }))
  }, [topCategories, otherTotal])

  return (
    <Card className="bg-white rounded-xl border border-navy-100 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-navy-900 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-amber-500" />
          Expenses by Category
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-navy-400">
            No data available
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={260}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Amount']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #d9e2ec', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2 max-h-[260px] overflow-y-auto">
              {chartData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                  <span className="text-navy-600 truncate flex-1">{entry.name}</span>
                  <span className="font-medium text-navy-800 text-xs">{formatCurrency(entry.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ===== MAIN COMPONENT =====

export function DashboardPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT'

  // Filters
  const [monthFilter, setMonthFilter] = useState(() => format(new Date(), 'yyyy-MM'))
  const [clientFilter, setClientFilter] = useState<string>('all')
  const [siteFilter, setSiteFilter] = useState<string>('all')

  // Fetch clients and sites for filters
  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.getClients() as Promise<Array<{ id: string; name: string }>>,
  })

  const { data: sites } = useQuery({
    queryKey: ['sites', clientFilter],
    queryFn: () => api.getSites() as Promise<Array<{ id: string; name: string; clientId: string }>>,
    enabled: !!clients,
  })

  const filteredSites = useMemo(() => {
    if (!sites) return []
    if (clientFilter === 'all') return sites
    return sites.filter(s => s.clientId === clientFilter)
  }, [sites, clientFilter])

  // Build params
  const params = useMemo(() => {
    const p: Record<string, string> = { month: monthFilter }
    if (clientFilter !== 'all') p.clientId = clientFilter
    if (siteFilter !== 'all') p.siteId = siteFilter
    return p
  }, [monthFilter, clientFilter, siteFilter])

  // Fetch dashboard data
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard', params],
    queryFn: () => api.getDashboard(params) as Promise<DashboardData>,
  })

  // Generate month options (last 12 months)
  const monthOptions = useMemo(() => {
    const months: { value: string; label: string }[] = []
    for (let i = 0; i < 12; i++) {
      const d = subMonths(new Date(), i)
      months.push({ value: format(d, 'yyyy-MM'), label: format(d, 'MMM yyyy') })
    }
    return months
  }, [])

  return (
    <div className="space-y-6">
      {/* Header + Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-900">Dashboard</h2>
          <p className="text-sm text-navy-500 mt-0.5">
            {user?.name ? `Welcome back, ${user.name}` : 'Overview of your expenses and activity'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-[150px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isAdmin && clients && (
            <Select value={clientFilter} onValueChange={(v) => { setClientFilter(v); setSiteFilter('all') }}>
              <SelectTrigger className="w-[170px] h-9 text-sm">
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {isAdmin && (
            <Select value={siteFilter} onValueChange={setSiteFilter}>
              <SelectTrigger className="w-[170px] h-9 text-sm">
                <SelectValue placeholder="All Sites" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites</SelectItem>
                {filteredSites.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="This Month Expenses"
          value={formatCurrency(data?.stats.thisMonthExpenses.total ?? 0)}
          subtitle={`${data?.stats.thisMonthExpenses.count ?? 0} transactions`}
          icon={IndianRupee}
          accent="amber"
          loading={isLoading}
        />
        <StatCard
          title="Pending Approvals"
          value={String(data?.stats.pendingExpenses.count ?? 0)}
          subtitle={formatCurrency(data?.stats.pendingExpenses.total ?? 0)}
          icon={Clock}
          accent="amber"
          loading={isLoading}
        />
        <StatCard
          title="Paid This Month"
          value={formatCurrency(data?.stats.paidExpenses.total ?? 0)}
          subtitle={`${data?.stats.paidExpenses.count ?? 0} payments`}
          icon={CheckCircle2}
          accent="green"
          loading={isLoading}
        />
        <StatCard
          title="Late Submissions"
          value={String(data?.lateSubmissions.total ?? 0)}
          subtitle={formatCurrency(data?.lateSubmissions.totalAmount ?? 0)}
          icon={AlertTriangle}
          accent="red"
          loading={isLoading}
        />
      </div>

      {/* MIR Stats Row (for roles with MIR visibility) */}
      {(isAdmin || user?.role === 'STOCK_MANAGER') && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Pending MIRs"
            value={String(data?.stats.pendingMirs.count ?? 0)}
            subtitle={formatCurrency(data?.stats.pendingMirs.total ?? 0)}
            icon={FileText}
            accent="amber"
            loading={isLoading}
          />
          <StatCard
            title="Stock Mgr Approved"
            value={String(data?.stats.stockMgrApprovedMirs.count ?? 0)}
            subtitle={formatCurrency(data?.stats.stockMgrApprovedMirs.total ?? 0)}
            icon={CheckCircle2}
            accent="navy"
            loading={isLoading}
          />
          <StatCard
            title="Admin Approved MIRs"
            value={String(data?.stats.adminApprovedMirs.count ?? 0)}
            subtitle={formatCurrency(data?.stats.adminApprovedMirs.total ?? 0)}
            icon={CheckCircle2}
            accent="green"
            loading={isLoading}
          />
          <StatCard
            title="This Month MIRs"
            value={String(data?.stats.thisMonthMirs.count ?? 0)}
            subtitle={formatCurrency(data?.stats.thisMonthMirs.total ?? 0)}
            icon={TrendingUp}
            accent="navy"
            loading={isLoading}
          />
        </div>
      )}

      {/* Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <RecentExpensesTable expenses={data?.recentExpenses ?? []} loading={isLoading} />
        <RecentMirsTable mirs={data?.recentMirs ?? []} loading={isLoading} />
      </div>

      {/* Charts (admin/accountant only) */}
      {isAdmin && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <MonthlyChart data={data?.reports.byMonth ?? []} loading={isLoading} />
          <CategoryPieChart data={data?.reports.byCategory ?? []} loading={isLoading} />
        </div>
      )}

      {/* User Balances (admin/accountant only) */}
      {isAdmin && (
        <UserBalancesTable balances={data?.userBalances ?? []} loading={isLoading} />
      )}

      {/* Late Submissions Detail (admin/accountant only) */}
      {isAdmin && data && data.lateSubmissions.recent.length > 0 && (
        <Card className="bg-white rounded-xl border border-red-100 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-navy-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Recent Late Submissions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-navy-100 hover:bg-transparent">
                    <TableHead className="text-navy-500 font-medium">Description</TableHead>
                    <TableHead className="text-navy-500 font-medium">User</TableHead>
                    <TableHead className="text-navy-500 font-medium hidden sm:table-cell">Site</TableHead>
                    <TableHead className="text-navy-500 font-medium text-right">Amount</TableHead>
                    <TableHead className="text-navy-500 font-medium">Days Late</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lateSubmissions.recent.map(l => (
                    <TableRow key={l.id} className="border-navy-50 hover:bg-red-50/50">
                      <TableCell className="max-w-[200px] truncate font-medium text-navy-800">{l.description}</TableCell>
                      <TableCell className="text-navy-600 text-sm">{l.userName}</TableCell>
                      <TableCell className="text-navy-600 text-sm hidden sm:table-cell">{l.siteName}</TableCell>
                      <TableCell className="text-right font-semibold text-navy-900">{formatCurrency(l.amount)}</TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="text-[10px] font-medium px-2 py-0.5 bg-red-100 text-red-700 border border-red-200">
                          {l.daysLate}d
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
