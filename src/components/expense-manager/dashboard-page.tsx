'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  IndianRupee,
  Clock,
  CheckCircle2,
  BadgeCheck,
  Package,
  ArrowRight,
  ShoppingCart,
  CircleDot,
  AlertCircle,
  AlertTriangle,
  ClipboardCheck,
  PackageSearch,
  Banknote,
  Users as UsersIcon,
  TrendingUp,
  TrendingDown,
  Wallet,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts'

const statusColors: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  ACCOUNTANT_APPROVED: 'bg-cyan-100 text-cyan-800',
  ADMIN_APPROVED: 'bg-emerald-100 text-emerald-800',
  PAID: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  RETURNED: 'bg-orange-100 text-orange-800',
  STOCK_MANAGER_APPROVED: 'bg-cyan-100 text-cyan-800',
  ORDERED: 'bg-teal-100 text-teal-800',
  RECEIVED: 'bg-green-100 text-green-800',
}

const chartColors = [
  '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6',
  '#f97316', '#14b8a6', '#ec4899', '#6366f1', '#84cc16',
]

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  color: string
  subtitle?: string
  onClick?: () => void
  clickable?: boolean
}

function StatCard({
  title,
  value,
  icon,
  color,
  subtitle,
  onClick,
  clickable,
}: StatCardProps) {
  return (
    <Card className={`shadow-sm ${clickable ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`} onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold text-stone-900">{value}</p>
            {subtitle && <p className="text-xs text-stone-400">{subtitle}</p>}
          </div>
          <div className={`p-2 rounded-lg ${color}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function WorkflowDiagram() {
  const expenseSteps = [
    { label: 'PENDING', color: '#f59e0b' },
    { label: 'ACCT APPROVED', color: '#06b6d4' },
    { label: 'ADMIN APPROVED', color: '#10b981' },
    { label: 'PAID', color: '#22c55e' },
  ]

  const mirSteps = [
    { label: 'PENDING', color: '#f59e0b' },
    { label: 'STOCK MGR', color: '#06b6d4' },
    { label: 'ADMIN APPROVED', color: '#10b981' },
    { label: 'ORDERED', color: '#14b8a6' },
    { label: 'RECEIVED', color: '#22c55e' },
  ]

  const advanceSteps = [
    { label: 'PENDING', color: '#f59e0b' },
    { label: 'PAID', color: '#22c55e' },
  ]

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Expense Workflow</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex items-center gap-1 flex-wrap">
            {expenseSteps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-1">
                <div
                  className="px-2 py-1 rounded-md text-xs font-medium text-white whitespace-nowrap"
                  style={{ backgroundColor: step.color }}
                >
                  {step.label}
                </div>
                {i < expenseSteps.length - 1 && (
                  <ArrowRight className="w-3 h-3 text-stone-400 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">MIR Workflow</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex items-center gap-1 flex-wrap">
            {mirSteps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-1">
                <div
                  className="px-2 py-1 rounded-md text-xs font-medium text-white whitespace-nowrap"
                  style={{ backgroundColor: step.color }}
                >
                  {step.label}
                </div>
                {i < mirSteps.length - 1 && (
                  <ArrowRight className="w-3 h-3 text-stone-400 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Advance Workflow</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex items-center gap-1 flex-wrap">
            {advanceSteps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-1">
                <div
                  className="px-2 py-1 rounded-md text-xs font-medium text-white whitespace-nowrap"
                  style={{ backgroundColor: step.color }}
                >
                  {step.label}
                </div>
                {i < advanceSteps.length - 1 && (
                  <ArrowRight className="w-3 h-3 text-stone-400 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface DashboardPageProps {
  onNavigate: (tab: 'expenses' | 'requisitions' | 'boq' | 'dashboard' | 'reports' | 'advances') => void
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { user } = useAuth()
  const userRole = user?.role || 'USER'
  const isAdmin = userRole === 'ADMIN'
  const isAccountant = userRole === 'ACCOUNTANT'
  const isStockManager = userRole === 'STOCK_MANAGER'
  const isUser = userRole === 'USER'

  const [data, setData] = useState<any>(null)
  const [clients, setClients] = useState<any[]>([])
  const [sites, setSites] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Filters
  const [selectedClient, setSelectedClient] = useState('all')
  const [selectedSite, setSelectedSite] = useState('all')
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  )
  const [selectedUserId, setSelectedUserId] = useState<string>('all')

  // Late submissions state
  const [lateSubmissions, setLateSubmissions] = useState<any>(null)
  const [lateLoading, setLateLoading] = useState(true)

  // Reports data for site breakdown + pie chart
  const [reportsData, setReportsData] = useState<any>(null)
  const [reportsLoading, setReportsLoading] = useState(true)

  // Advances stats
  const [advanceStats, setAdvanceStats] = useState<{ totalApproved: number; pendingCount: number; totalPaid: number } | null>(null)
  const [advanceLoading, setAdvanceLoading] = useState(true)

  // User balances
  const [userBalances, setUserBalances] = useState<any[]>([])
  const [balancesLoading, setBalancesLoading] = useState(true)

  // All users for selectors
  const [allUsers, setAllUsers] = useState<any[]>([])

  // Employee filter for dashboard (separate from user selector for balances)
  const [selectedEmployee, setSelectedEmployee] = useState('all')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const params: Record<string, string> = {}
        const activeUserId = selectedUserId !== 'all' ? selectedUserId : ''
        if (activeUserId) params.userId = activeUserId
        if (selectedClient !== 'all') params.clientId = selectedClient
        if (selectedSite !== 'all') params.siteId = selectedSite
        if (selectedMonth) params.month = selectedMonth

        const [dashboardData, clientsData, sitesData] = await Promise.all([
          api.getDashboard(Object.keys(params).length > 0 ? params : undefined),
          api.getClients(),
          api.getSites(),
        ])
        setData(dashboardData)
        setClients(clientsData || [])
        setSites(sitesData || [])
      } catch {
        // handled by api
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [selectedUserId, selectedClient, selectedSite, selectedMonth])

  useEffect(() => {
    async function loadStats() {
      const params: Record<string, string> = { month: selectedMonth }
      if (selectedClient !== 'all') params.clientId = selectedClient
      if (selectedSite !== 'all') params.siteId = selectedSite
      const activeUserId = selectedUserId !== 'all' ? selectedUserId : ''
      if (activeUserId) params.userId = activeUserId
      try {
        const result = await api.getExpenseStats(params)
        setStats(result)
      } catch {
        // handled by api
      }
    }
    loadStats()
  }, [selectedClient, selectedSite, selectedMonth, selectedUserId, selectedEmployee])

  useEffect(() => {
    async function loadLate() {
      setLateLoading(true)
      try {
        const result = await api.getLateSubmissions({ months: '6' })
        setLateSubmissions(result)
      } catch {
        // handled by api
      } finally {
        setLateLoading(false)
      }
    }
    loadLate()
  }, [])

  // Fetch reports data for site breakdown + pie chart on dashboard
  useEffect(() => {
    async function loadReports() {
      setReportsLoading(true)
      try {
        const params: Record<string, string> = { period: 'monthly' }
        if (selectedClient !== 'all') params.clientId = selectedClient
        if (selectedSite !== 'all') params.siteId = selectedSite
        const activeUserId = selectedUserId !== 'all' ? selectedUserId : ''
        if (activeUserId) params.userId = activeUserId
        const result = await api.getReports(params)
        setReportsData(result)
      } catch {
        // handled by api
      } finally {
        setReportsLoading(false)
      }
    }
    loadReports()
  }, [selectedClient, selectedSite, selectedUserId])

  // Fetch advance stats
  useEffect(() => {
    async function loadAdvances() {
      setAdvanceLoading(true)
      try {
        const params: Record<string, string> = { status: 'PENDING,PAID', limit: '200' }
        const activeUserId = selectedUserId !== 'all' ? selectedUserId : ''
        if (activeUserId) params.userId = activeUserId
        if (selectedClient !== 'all') params.clientId = selectedClient
        if (selectedSite !== 'all') params.siteId = selectedSite
        const result = await api.getAdvances(params)
        const advances = result.data || []
        const totalPaid = advances
          .filter((a: any) => a.status === 'PAID')
          .reduce((sum: number, a: any) => sum + (a.amount || 0), 0)
        const pendingCount = advances.filter((a: any) => a.status === 'PENDING').length
        setAdvanceStats({ totalApproved: totalPaid, pendingCount, totalPaid })
      } catch {
        // handled by api
      } finally {
        setAdvanceLoading(false)
      }
    }
    loadAdvances()
  }, [selectedUserId, selectedClient, selectedSite])

  // Fetch user balances for admin/accountant
  useEffect(() => {
    if (isAdmin || isAccountant) {
      async function loadBalances() {
        setBalancesLoading(true)
        try {
          const params: Record<string, string> = {}
          if (selectedClient !== 'all') params.clientId = selectedClient
          if (selectedSite !== 'all') params.siteId = selectedSite
          if (selectedMonth) params.month = selectedMonth
          const activeUserId = selectedUserId !== 'all' ? selectedUserId : ''
          if (activeUserId) params.userId = activeUserId
          const balances = await api.getUserBalances(params)
          setUserBalances(balances)
        } catch {
          // handled
        } finally {
          setBalancesLoading(false)
        }
      }
      loadBalances()
    }
  }, [isAdmin, isAccountant, selectedUserId, selectedClient, selectedSite, selectedMonth])

  // Fetch all users for admin/accountant
  useEffect(() => {
    if (isAdmin || isAccountant) {
      api.getUsers().then((users) => setAllUsers(users || [])).catch(() => {})
    }
  }, [isAdmin, isAccountant])

  const filteredSites = selectedClient === 'all'
    ? sites
    : sites.filter((s: any) => s.clientId === selectedClient)

  // Selected user info for balance display
  const selectedUserBalance = (isAdmin || isAccountant) && selectedUserId !== 'all'
    ? userBalances.find((b: any) => b.userId === selectedUserId)
    : null

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  const d = data || {}

  // Pending count for accountant
  const pendingForAccountant = d.pendingExpenses?.count || 0

  // Pending material requests for stock manager
  const pendingMRs = d.pendingMirs?.count || 0

  return (
    <div className="space-y-6">
      {/* ===== GLOBAL FILTERS (Admin/Accountant) ===== */}
      {(isAdmin || isAccountant) && (
        <Card className="shadow-sm border-stone-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-stone-500 font-medium">Filters:</span>

              {/* User Selector */}
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-44 h-8 text-xs">
                  <UsersIcon className="w-3 h-3 mr-1 text-stone-400" />
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Users</SelectItem>
                  {allUsers.map((u: any) => (
                    <SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Client */}
              <Select value={selectedClient} onValueChange={(v) => { setSelectedClient(v); setSelectedSite('all') }}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue placeholder="Client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Clients</SelectItem>
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Site */}
              <Select value={selectedSite} onValueChange={setSelectedSite}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue placeholder="Site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Sites</SelectItem>
                  {filteredSites.map((s: any) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Month */}
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => {
                    const date = new Date()
                    date.setMonth(date.getMonth() - i)
                    const val = date.toISOString().slice(0, 7)
                    return (
                      <SelectItem key={val} value={val} className="text-xs">
                        {date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>

              {/* Clear Filters */}
              {(selectedClient !== 'all' || selectedSite !== 'all' || selectedUserId !== 'all' || selectedMonth !== new Date().toISOString().slice(0, 7)) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-stone-500 hover:text-stone-900"
                  onClick={() => {
                    setSelectedClient('all')
                    setSelectedSite('all')
                    setSelectedUserId('all')
                    setSelectedMonth(new Date().toISOString().slice(0, 7))
                    setSelectedEmployee('all')
                  }}
                >
                  Clear All
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== EMPLOYEE FILTER for non-admin users or additional filtering ===== */}
      {!isAdmin && !isAccountant && (
        <Card className="shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-stone-500 font-medium">Filters:</span>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => {
                    const date = new Date()
                    date.setMonth(date.getMonth() - i)
                    const val = date.toISOString().slice(0, 7)
                    return (
                      <SelectItem key={val} value={val} className="text-xs">
                        {date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== ROLE-SPECIFIC: Accountant awaiting approval ===== */}
      {isAccountant && pendingForAccountant > 0 && (
        <Card className="shadow-sm border-cyan-200 bg-cyan-50/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-cyan-100">
                <ClipboardCheck className="w-6 h-6 text-cyan-700" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-cyan-900">Awaiting Your Approval</p>
                <p className="text-xs text-cyan-600">
                  You have <span className="font-bold text-cyan-800">{pendingForAccountant} pending expense{pendingForAccountant !== 1 ? 's' : ''}</span> that need accountant review
                </p>
              </div>
              <Button
                size="sm"
                className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs h-8"
                onClick={() => onNavigate('expenses')}
              >
                Review Now
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== ROLE-SPECIFIC: Stock Manager pending material requests ===== */}
      {isStockManager && pendingMRs > 0 && (
        <Card className="shadow-sm border-emerald-200 bg-emerald-50/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-100">
                <PackageSearch className="w-6 h-6 text-emerald-700" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-900">Pending Material Requests</p>
                <p className="text-xs text-emerald-600">
                  You have <span className="font-bold text-emerald-800">{pendingMRs} material request{pendingMRs !== 1 ? 's' : ''}</span> that need stock manager approval
                </p>
              </div>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                onClick={() => onNavigate('requisitions')}
              >
                Review Now
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== SELECTED USER BALANCE CARD (Admin/Accountant with user selected) ===== */}
      {(isAdmin || isAccountant) && selectedUserBalance && (
        <Card className="shadow-sm border-violet-200 bg-violet-50/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-violet-100">
                <Wallet className="w-6 h-6 text-violet-700" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-violet-900">
                  Balance: {selectedUserBalance.name}
                </p>
                <p className="text-xs text-violet-600">
                  Advance: ₹{selectedUserBalance.totalAdvances.toLocaleString()} &minus; Expenses: ₹{selectedUserBalance.totalExpenses.toLocaleString()} =
                  {' '}
                  <span className={`font-bold text-lg ${selectedUserBalance.balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    ₹{selectedUserBalance.balance.toLocaleString()}
                  </span>
                </p>
              </div>
              {selectedUserBalance.balance >= 0 ? (
                <TrendingUp className="w-8 h-8 text-green-500" />
              ) : (
                <TrendingDown className="w-8 h-8 text-red-500" />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== ROLE-SPECIFIC: User simplified stats ===== */}
      {isUser && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="My Expenses"
            value={d.thisMonthExpenses?.count || 0}
            icon={<IndianRupee className="w-4 h-4 text-amber-600" />}
            color="bg-amber-50"
            subtitle={`₹ ${(d.thisMonthExpenses?.total || 0).toLocaleString()} this month`}
            onClick={() => onNavigate('expenses')}
            clickable
          />
          <StatCard
            title="Pending"
            value={d.pendingExpenses?.count || 0}
            icon={<Clock className="w-4 h-4 text-amber-600" />}
            color="bg-amber-50"
            subtitle="Awaiting approval"
            onClick={() => onNavigate('expenses')}
            clickable
          />
          <StatCard
            title="Reports"
            value="View"
            icon={<Package className="w-4 h-4 text-stone-600" />}
            color="bg-stone-100"
            subtitle="Analytics & reports"
            onClick={() => onNavigate('reports')}
            clickable
          />
        </div>
      )}

      {/* ===== ADMIN / ACCOUNTANT / STOCK_MANAGER: Full dashboard ===== */}
      {!isUser && (
        <>
          {/* Expense stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="This Month Expenses"
              value={`₹ ${(d.thisMonthExpenses?.total || 0).toLocaleString()}`}
              icon={<IndianRupee className="w-4 h-4 text-amber-600" />}
              color="bg-amber-50"
              subtitle={`${d.thisMonthExpenses?.count || 0} expenses`}
              onClick={() => onNavigate('expenses')}
              clickable
            />
            <StatCard
              title="Pending Expenses"
              value={d.pendingExpenses?.count || 0}
              icon={<Clock className="w-4 h-4 text-amber-600" />}
              color="bg-amber-50"
              onClick={() => onNavigate('expenses')}
              clickable
            />
            <StatCard
              title="Accountant Approved"
              value={d.accountantApprovedExpenses?.count || 0}
              icon={<CheckCircle2 className="w-4 h-4 text-cyan-600" />}
              color="bg-cyan-50"
              onClick={() => onNavigate('expenses')}
              clickable
            />
            <StatCard
              title="Paid Expenses"
              value={d.paidExpenses?.count || 0}
              icon={<BadgeCheck className="w-4 h-4 text-green-600" />}
              color="bg-green-50"
              onClick={() => onNavigate('expenses')}
              clickable
            />
          </div>

          {/* MR stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Pending MRs"
              value={d.pendingMirs?.count || 0}
              icon={<Clock className="w-4 h-4 text-amber-600" />}
              color="bg-amber-50"
              onClick={() => onNavigate('requisitions')}
              clickable
            />
            <StatCard
              title="Stock Mgr Approved"
              value={d.stockMgrApprovedMirs?.count || 0}
              icon={<CheckCircle2 className="w-4 h-4 text-cyan-600" />}
              color="bg-cyan-50"
              onClick={() => onNavigate('requisitions')}
              clickable
            />
            <StatCard
              title="Admin Approved MRs"
              value={d.adminApprovedMirs?.count || 0}
              icon={<BadgeCheck className="w-4 h-4 text-emerald-600" />}
              color="bg-emerald-50"
              onClick={() => onNavigate('requisitions')}
              clickable
            />
            <StatCard
              title="This Month MRs"
              value={d.thisMonthMirs?.count || 0}
              icon={<Package className="w-4 h-4 text-stone-600" />}
              color="bg-stone-100"
              subtitle={`₹ ${(d.thisMonthMirs?.total || 0).toLocaleString()}`}
              onClick={() => onNavigate('requisitions')}
              clickable
            />
          </div>
        </>
      )}

      {/* ===== Advances Stats ===== */}
      {isUser ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            title="My Advances (Paid)"
            value={advanceLoading ? '...' : `₹ ${(advanceStats?.totalPaid || 0).toLocaleString()}`}
            icon={<Banknote className="w-4 h-4 text-violet-600" />}
            color="bg-violet-50"
            subtitle="Total disbursed"
            onClick={() => onNavigate('advances')}
            clickable
          />
          <StatCard
            title="Pending Advances"
            value={advanceLoading ? '...' : advanceStats?.pendingCount || 0}
            icon={<Clock className="w-4 h-4 text-amber-600" />}
            color="bg-amber-50"
            subtitle="Awaiting approval"
            onClick={() => onNavigate('advances')}
            clickable
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Total Advances (Paid)"
            value={advanceLoading ? '...' : `₹ ${(advanceStats?.totalPaid || 0).toLocaleString()}`}
            icon={<Banknote className="w-4 h-4 text-violet-600" />}
            color="bg-violet-50"
            subtitle="Disbursed amount"
            onClick={() => onNavigate('advances')}
            clickable
          />
          <StatCard
            title="Pending Advances"
            value={advanceLoading ? '...' : advanceStats?.pendingCount || 0}
            icon={<Clock className="w-4 h-4 text-amber-600" />}
            color="bg-amber-50"
            subtitle="Awaiting approval"
            onClick={() => onNavigate('advances')}
            clickable
          />
          <StatCard
            title="Net Balance (Advances - Expenses)"
            value={(() => {
              const totalAdv = advanceStats?.totalPaid || 0
              const totalExp = (d.thisMonthExpenses?.total || 0)
              const balance = totalAdv - totalExp
              return `₹ ${balance.toLocaleString()}`
            })()}
            icon={<Wallet className="w-4 h-4 text-stone-600" />}
            color={`${(advanceStats?.totalPaid || 0) - (d.thisMonthExpenses?.total || 0) >= 0 ? 'bg-green-50' : 'bg-red-50'}`}
            subtitle={`${selectedMonth ? new Date(selectedMonth + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'This Month'}: Advances Paid − Expenses`}
            onClick={() => onNavigate('advances')}
            clickable
          />
        </div>
      )}

      {/* ===== USER BALANCE TABLE (Admin/Accountant only) — PROMINENT DISPLAY ===== */}
      {(isAdmin || isAccountant) && (
        <Card className="shadow-sm border-violet-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-violet-50">
                  <Wallet className="w-4 h-4 text-violet-600" />
                </div>
                <CardTitle className="text-sm font-bold">Current Balance: All Users (Advance − Expenses)</CardTitle>
              </div>
              <span className="text-xs text-stone-400">
                {selectedMonth ? new Date(selectedMonth + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'This Month'}
              </span>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            {balancesLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : (() => {
              const filteredBalances = userBalances.filter((b: any) => b.totalAdvances > 0 || b.totalExpenses > 0)
              const totalAdvances = filteredBalances.reduce((s: number, b: any) => s + b.totalAdvances, 0)
              const totalExpenses = filteredBalances.reduce((s: number, b: any) => s + b.totalExpenses, 0)
              const netBalance = totalAdvances - totalExpenses
              return filteredBalances.length > 0 ? (
                <div className="space-y-4">
                  {/* Summary row */}
                  <div className={`grid grid-cols-3 gap-4 p-3 rounded-lg ${netBalance >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="text-center">
                      <p className="text-xs text-stone-500">Total Advances</p>
                      <p className="text-lg font-bold text-violet-700">₹{totalAdvances.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-stone-500">Total Expenses</p>
                      <p className="text-lg font-bold text-amber-700">₹{totalExpenses.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-stone-500">Net Balance</p>
                      <p className={`text-lg font-bold ${netBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>₹{netBalance.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Employee</TableHead>
                          <TableHead className="text-xs">Role</TableHead>
                          <TableHead className="text-xs text-right">Advances (₹)</TableHead>
                          <TableHead className="text-xs text-right">Expenses (₹)</TableHead>
                          <TableHead className="text-xs text-right font-bold">Balance (₹)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBalances.map((b: any) => (
                          <TableRow
                            key={b.userId}
                            className={`cursor-pointer hover:bg-stone-50 ${selectedUserId === b.userId ? 'bg-violet-50' : ''}`}
                            onClick={() => setSelectedUserId(b.userId)}
                          >
                            <TableCell className="text-xs font-medium">{b.name}</TableCell>
                            <TableCell className="text-xs">
                              <Badge className={`text-[10px] ${statusColors[b.role === 'ADMIN' ? 'PAID' : b.role === 'ACCOUNTANT' ? 'ACCOUNTANT_APPROVED' : b.role === 'STOCK_MANAGER' ? 'STOCK_MANAGER_APPROVED' : 'PENDING'] || ''}`}>
                                {b.role}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-right font-medium text-violet-700">
                              ₹{b.totalAdvances.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-xs text-right font-medium text-amber-700">
                              ₹{b.totalExpenses.toLocaleString()}
                            </TableCell>
                            <TableCell className={`text-xs text-right font-bold ${b.balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              ₹{b.balance.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-stone-100 font-semibold">
                          <TableCell className="text-xs">Total</TableCell>
                          <TableCell className="text-xs" />
                          <TableCell className="text-xs text-right">
                            ₹{totalAdvances.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            ₹{totalExpenses.toLocaleString()}
                          </TableCell>
                          <TableCell className={`text-xs text-right ${netBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            ₹{netBalance.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[100px] text-stone-400 text-sm">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  No balance data available
                </div>
              )
            })()}
          </CardContent>
        </Card>
      )}

      {/* ===== Monthly Late Submissions — Admin/Accountant only ===== */}
      {(isAdmin || isAccountant) && (
        <Card className="shadow-sm border-amber-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-50">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                </div>
                <CardTitle className="text-sm font-medium">Monthly Late Submissions</CardTitle>
              </div>
              <span className="text-xs text-stone-400">Last 6 months</span>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            {lateLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : lateSubmissions?.monthlyBreakdown && lateSubmissions.monthlyBreakdown.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-amber-50 rounded-lg">
                    <p className="text-xs text-stone-500">Total Late Submissions</p>
                    <p className="text-xl font-bold text-stone-900">{lateSubmissions.total || 0}</p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg">
                    <p className="text-xs text-stone-500">Total Late Amount</p>
                    <p className="text-xl font-bold text-stone-900">₹ {(lateSubmissions.totalAmount || 0).toLocaleString()}</p>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Month</TableHead>
                        <TableHead className="text-xs text-center">Count</TableHead>
                        <TableHead className="text-xs text-center">Avg Days Late</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lateSubmissions.monthlyBreakdown.map((m: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs font-medium">{m.month ? new Date(m.month + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : '-'}</TableCell>
                          <TableCell className="text-xs text-center">{m.count || 0}</TableCell>
                          <TableCell className="text-xs text-center">
                            <Badge className={`text-[10px] ${m.avgDaysLate > 3 ? 'bg-red-100 text-red-800' : m.avgDaysLate > 1 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                              {m.avgDaysLate || 0} days
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[100px] text-stone-400 text-sm">
                <AlertCircle className="w-4 h-4 mr-2" />
                No late submissions in the last 6 months
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ===== Workflow diagrams — Admin only ===== */}
      {isAdmin && <WorkflowDiagram />}

      {/* ===== Charts + Recent Tables — hidden for USER ===== */}
      {!isUser && (
        <>
      {/* ===== Monthly Expense Report by Category (Bar) + Category Pie (side-by-side) ===== */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Bar Chart - Category */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <div className="w-1.5 h-4 bg-amber-500 rounded-full" />
                Monthly Expense Report by Category
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            {stats?.categoryBreakdown && stats.categoryBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.categoryBreakdown} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                  <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => [`₹ ${value.toLocaleString()}`, 'Amount']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e7e5e4', fontSize: '12px' }}
                  />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                    {stats.categoryBreakdown.map((_: any, index: number) => (
                      <Cell key={index} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-stone-400 text-sm">
                <AlertCircle className="w-4 h-4 mr-2" />
                No expense data for this period
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pie Chart - Category Distribution */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div className="w-1.5 h-4 bg-purple-500 rounded-full" />
              Category Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {stats?.categoryBreakdown && stats.categoryBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.categoryBreakdown}
                    dataKey="total"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={95}
                    innerRadius={45}
                    paddingAngle={2}
                    label={({ category, percent }) =>
                      `${category?.length > 12 ? category.slice(0, 12) + '...' : category} (${(percent * 100).toFixed(0)}%)`
                    }
                    labelLine={{ stroke: '#a8a29e', strokeWidth: 1 }}
                  >
                    {stats.categoryBreakdown.map((_: any, index: number) => (
                      <Cell key={index} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`₹ ${value.toLocaleString()}`, 'Amount']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e7e5e4', fontSize: '12px' }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-stone-400 text-sm">
                <AlertCircle className="w-4 h-4 mr-2" />
                No category data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Spending by Site - Bar Chart */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <div className="w-1.5 h-4 bg-blue-500 rounded-full" />
            Spending by Site
            <span className="text-[10px] font-normal text-stone-400 ml-1">(Last 6 months)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          {reportsLoading ? (
            <Skeleton className="h-[250px] w-full rounded-lg" />
          ) : reportsData?.bySite && reportsData.bySite.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={reportsData.bySite}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹ ${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="siteName" tick={{ fontSize: 11 }} width={110} />
                <Tooltip
                  formatter={(value: number) => [`₹ ${value.toLocaleString()}`, 'Amount']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e7e5e4', fontSize: '12px' }}
                />
                <Bar dataKey="total" name="Amount" radius={[0, 4, 4, 0]} barSize={20}>
                  {reportsData.bySite.map((_: any, index: number) => (
                    <Cell key={index} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-stone-400 text-sm">
              <AlertCircle className="w-4 h-4 mr-2" />
              No site data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent tables */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent expenses */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-stone-500" />
                <CardTitle className="text-sm font-medium">Recent Expenses</CardTitle>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-stone-500 hover:text-stone-900" onClick={() => onNavigate('expenses')}>
                View All <CircleDot className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            {d.recentExpenses && d.recentExpenses.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Description</TableHead>
                      <TableHead className="text-xs">Amount</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.recentExpenses.map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs max-w-[150px] truncate">{e.description}</TableCell>
                        <TableCell className="text-xs font-medium">₹ {e.amount?.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${statusColors[e.status] || ''}`}>
                            {e.status?.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-stone-400 text-center py-8">No recent expenses</p>
            )}
          </CardContent>
        </Card>

        {/* Recent requisitions */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-stone-500" />
                <CardTitle className="text-sm font-medium">Recent MRs</CardTitle>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-stone-500 hover:text-stone-900" onClick={() => onNavigate('requisitions')}>
                View All <CircleDot className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            {d.recentMirs && d.recentMirs.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Title</TableHead>
                      <TableHead className="text-xs">Amount</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.recentMirs.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs max-w-[150px] truncate">{r.title}</TableCell>
                        <TableCell className="text-xs font-medium">₹ {r.totalAmount?.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${statusColors[r.status] || ''}`}>
                            {r.status?.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-stone-400 text-center py-8">No recent requisitions</p>
            )}
          </CardContent>
        </Card>
      </div>
        </>
      )}
    </div>
  )
}
