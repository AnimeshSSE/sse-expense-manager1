'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  IndianRupee,
  TrendingUp,
  Hash,
  Calculator,
  ArrowUpRight,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  AlertCircle,
  BarChart3,
  Loader2,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
import { exportToCSV, exportToXLS, exportToPDF } from '@/lib/export'

const CHART_COLORS = [
  '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6',
  '#f97316', '#14b8a6', '#ec4899', '#6366f1', '#84cc16',
]

interface ReportData {
  period: string
  startDate: string
  totalAmount: number
  totalCount: number
  byCategory: Array<{
    categoryId: string
    categoryName: string
    total: number
    count: number
  }>
  byMonth: Array<{
    month: string
    total: number
    count: number
  }>
  bySite: Array<{
    siteId: string
    siteName: string
    total: number
    count: number
  }>
}

export function ReportsPage() {
  const [period, setPeriod] = useState<'monthly' | 'quarterly'>('monthly')
  const [clientId, setClientId] = useState('')
  const [siteId, setSiteId] = useState('')
  const [userId, setUserId] = useState('')

  const [clients, setClients] = useState<any[]>([])
  const [sites, setSites] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtersLoading, setFiltersLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  // Load filter options
  useEffect(() => {
    async function loadFilters() {
      setFiltersLoading(true)
      try {
        const [clientsData, sitesData, usersData] = await Promise.all([
          api.getClients(),
          api.getSites(),
          api.getUsers(),
        ])
        setClients(clientsData || [])
        setSites(sitesData || [])
        setUsers(usersData || [])
      } catch {
        // handled by api
      } finally {
        setFiltersLoading(false)
      }
    }
    loadFilters()
  }, [])

  // Load report data
  useEffect(() => {
    async function loadReport() {
      setLoading(true)
      try {
        const params: Record<string, string> = { period }
        if (clientId) params.clientId = clientId
        if (siteId) params.siteId = siteId
        if (userId) params.userId = userId
        const result = await api.getReports(params)
        setReportData(result)
      } catch {
        // handled by api
      } finally {
        setLoading(false)
      }
    }
    loadReport()
  }, [period, clientId, siteId, userId])

  const filteredSites = clientId
    ? sites.filter((s: any) => s.clientId === clientId)
    : sites

  // Derived values
  const totalAmount = reportData?.totalAmount || 0
  const totalCount = reportData?.totalCount || 0
  const averagePerTransaction = totalCount > 0 ? Math.round(totalAmount / totalCount) : 0
  const highestSingleExpense = reportData?.byCategory?.length
    ? Math.max(...reportData.byCategory.map((c) => c.total))
    : 0

  // Export handlers
  const buildExportData = () => {
    if (!reportData?.byCategory?.length) return null
    return reportData.byCategory.map((c) => ({
      ...c,
      pct: totalAmount > 0 ? ((c.total / totalAmount) * 100).toFixed(1) : '0',
    }))
  }

  const exportColumns = [
    { key: 'categoryName', label: 'Category' },
    { key: 'total', label: 'Amount (₹)', format: (v: number) => v.toLocaleString() },
    { key: 'count', label: 'Count' },
    {
      key: 'pct',
      label: '% of Total',
      format: (_v: number, row: any) =>
        totalAmount > 0 ? ((row.total / totalAmount) * 100).toFixed(1) + '%' : '0%',
    },
  ]

  const handleExportCSV = async () => {
    const data = buildExportData()
    if (!data) {
      toast({ title: 'No data', description: 'No report data to export', variant: 'destructive' })
      return
    }
    setExporting(true)
    try {
      exportToCSV(data, exportColumns, `expense-report-${period}-${new Date().toISOString().slice(0, 10)}`)
      toast({ title: 'Exported', description: `${data.length} categories exported as CSV` })
    } catch {
      toast({ title: 'Error', description: 'Export failed', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  const handleExportXLS = async () => {
    const data = buildExportData()
    if (!data) {
      toast({ title: 'No data', description: 'No report data to export', variant: 'destructive' })
      return
    }
    setExporting(true)
    try {
      await exportToXLS(data, exportColumns, `expense-report-${period}-${new Date().toISOString().slice(0, 10)}`)
      toast({ title: 'Exported', description: `${data.length} categories exported as Excel` })
    } catch {
      toast({ title: 'Error', description: 'Export failed', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  const handleExportPDF = async () => {
    const data = buildExportData()
    if (!data) {
      toast({ title: 'No data', description: 'No report data to export', variant: 'destructive' })
      return
    }
    setExporting(true)
    try {
      await exportToPDF(
        data,
        exportColumns,
        `expense-report-${period}-${new Date().toISOString().slice(0, 10)}`,
        `Expense Report - ${period === 'monthly' ? 'Monthly' : 'Quarterly'}`
      )
      toast({ title: 'Exported', description: `${data.length} categories exported as PDF` })
    } catch {
      toast({ title: 'Error', description: 'Export failed', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  // Format month for trend chart
  const formatMonth = (monthStr: string) => {
    if (!monthStr) return ''
    const [year, month] = monthStr.split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, 1)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
  }

  // Trend data sorted ascending for chart
  const trendData = reportData?.byMonth
    ? [...reportData.byMonth].sort((a, b) => a.month.localeCompare(b.month)).map((m) => ({
        ...m,
        label: formatMonth(m.month),
      }))
    : []

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-stone-200 rounded-lg px-3 py-2 shadow-sm text-xs">
        <p className="font-medium text-stone-700 mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} style={{ color: entry.color || entry.fill }} className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
            {entry.name}: {typeof entry.value === 'number' ? `₹ ${entry.value.toLocaleString()}` : entry.value}
          </p>
        ))}
      </div>
    )
  }

  if (filtersLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-stone-600" />
            Expense Reports
          </h1>
          <p className="text-sm text-stone-500 mt-1">Analyze spending patterns and generate reports</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" disabled={exporting}>
                {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {exporting ? 'Exporting...' : 'Export'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportCSV} className="text-xs gap-2">
                <FileText className="w-3.5 h-3.5" /> CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportXLS} className="text-xs gap-2">
                <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF} className="text-xs gap-2">
                <FileText className="w-3.5 h-3.5" /> PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs font-medium text-stone-500">
              <Filter className="w-3.5 h-3.5" />
              Filters:
            </div>
            <div className="flex flex-col sm:flex-row gap-3 flex-1 flex-wrap">
              {/* Period */}
              <div className="space-y-1">
                <label className="text-[11px] text-stone-500 font-medium">Period</label>
                <Select value={period} onValueChange={(v) => setPeriod(v as 'monthly' | 'quarterly')}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly" className="text-xs">Monthly (6 months)</SelectItem>
                    <SelectItem value="quarterly" className="text-xs">Quarterly (12 months)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Client */}
              <div className="space-y-1">
                <label className="text-[11px] text-stone-500 font-medium">Client</label>
                <Select value={clientId} onValueChange={(v) => { setClientId(v === '__all__' ? '' : v); setSiteId('') }}>
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue placeholder="All Clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__" className="text-xs">All Clients</SelectItem>
                    {clients.map((c: any) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Site */}
              <div className="space-y-1">
                <label className="text-[11px] text-stone-500 font-medium">Site</label>
                <Select value={siteId} onValueChange={(v) => setSiteId(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue placeholder="All Sites" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__" className="text-xs">All Sites</SelectItem>
                    {filteredSites.map((s: any) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* User */}
              <div className="space-y-1">
                <label className="text-[11px] text-stone-500 font-medium">User</label>
                <Select value={userId} onValueChange={(v) => setUserId(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue placeholder="All Users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__" className="text-xs">All Users</SelectItem>
                    {users.map((u: any) => (
                      <SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading state for report data */}
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Total Amount</p>
                    <p className="text-2xl font-bold text-stone-900">₹ {totalAmount.toLocaleString()}</p>
                    <p className="text-xs text-stone-400">{period === 'monthly' ? 'Last 6 months' : 'Last 12 months'}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50">
                    <IndianRupee className="w-4 h-4 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Total Count</p>
                    <p className="text-2xl font-bold text-stone-900">{totalCount.toLocaleString()}</p>
                    <p className="text-xs text-stone-400">Transactions</p>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-50">
                    <Hash className="w-4 h-4 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Avg per Transaction</p>
                    <p className="text-2xl font-bold text-stone-900">₹ {averagePerTransaction.toLocaleString()}</p>
                    <p className="text-xs text-stone-400">Average</p>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-50">
                    <Calculator className="w-4 h-4 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Highest Category</p>
                    <p className="text-2xl font-bold text-stone-900">₹ {highestSingleExpense.toLocaleString()}</p>
                    <p className="text-xs text-stone-400">
                      {reportData?.byCategory?.[0]?.categoryName || 'N/A'}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-red-50">
                    <ArrowUpRight className="w-4 h-4 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 1: Spending by Category + Spending Trend */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Spending by Category - Horizontal Bar Chart */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-amber-500 rounded-full" />
                  Spending by Category
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                {reportData?.byCategory && reportData.byCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={reportData.byCategory}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹ ${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="categoryName" tick={{ fontSize: 11 }} width={100} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="total" name="Amount" radius={[0, 4, 4, 0]} barSize={20}>
                        {reportData.byCategory.map((_, index) => (
                          <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-stone-400 text-sm">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    No category data for this period
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Spending Trend - Line Chart */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                  Spending Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹ ${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        verticalAlign="top"
                        height={30}
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: '11px' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="total"
                        name="Amount"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-stone-400 text-sm">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    No trend data for this period
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2: Spending by Site + Category Pie Chart */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Spending by Site - Horizontal Bar Chart */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-blue-500 rounded-full" />
                  Spending by Site
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                {reportData?.bySite && reportData.bySite.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={reportData.bySite}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹ ${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="siteName" tick={{ fontSize: 11 }} width={110} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="total" name="Amount" radius={[0, 4, 4, 0]} barSize={20}>
                        {reportData.bySite.map((_, index) => (
                          <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-stone-400 text-sm">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    No site data for this period
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Category Breakdown - Pie Chart */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-purple-500 rounded-full" />
                  Category Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                {reportData?.byCategory && reportData.byCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={reportData.byCategory}
                        dataKey="total"
                        nameKey="categoryName"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        innerRadius={50}
                        paddingAngle={2}
                        label={({ categoryName, percent }) =>
                          `${categoryName?.length > 10 ? categoryName.slice(0, 10) + '...' : categoryName} (${(percent * 100).toFixed(0)}%)`
                        }
                        labelLine={{ stroke: '#a8a29e', strokeWidth: 1 }}
                      >
                        {reportData.byCategory.map((_, index) => (
                          <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
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
                  <div className="flex items-center justify-center h-[250px] text-stone-400 text-sm">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    No category data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Category Breakdown Table */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <div className="w-1.5 h-4 bg-stone-500 rounded-full" />
                Category Breakdown Details
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              {reportData?.byCategory && reportData.byCategory.length > 0 ? (
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-8">#</TableHead>
                        <TableHead className="text-xs">Category</TableHead>
                        <TableHead className="text-xs text-right">Amount</TableHead>
                        <TableHead className="text-xs text-right">Count</TableHead>
                        <TableHead className="text-xs text-right">% of Total</TableHead>
                        <TableHead className="text-xs text-right">Avg per Transaction</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.byCategory.map((cat, index) => {
                        const pct = totalAmount > 0 ? ((cat.total / totalAmount) * 100) : 0
                        const avgPerTx = cat.count > 0 ? Math.round(cat.total / cat.count) : 0
                        return (
                          <TableRow key={cat.categoryId}>
                            <TableCell className="text-xs">
                              <div
                                className="w-3 h-3 rounded-sm"
                                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                              />
                            </TableCell>
                            <TableCell className="text-xs font-medium">{cat.categoryName}</TableCell>
                            <TableCell className="text-xs text-right font-medium">₹ {cat.total.toLocaleString()}</TableCell>
                            <TableCell className="text-xs text-right">{cat.count}</TableCell>
                            <TableCell className="text-xs text-right">
                              <Badge
                                variant="secondary"
                                className={`text-[10px] font-medium ${
                                  pct > 25
                                    ? 'bg-amber-100 text-amber-800'
                                    : pct > 10
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-stone-100 text-stone-700'
                                }`}
                              >
                                {pct.toFixed(1)}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-right text-stone-500">
                              ₹ {avgPerTx.toLocaleString()}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[100px] text-stone-400 text-sm">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  No category data available
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
