'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { useLanguage } from '@/hooks/use-language'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts'
import { Download, FileSpreadsheet, FileText, TrendingUp } from 'lucide-react'

const PIE_COLORS = ['#f59e0b', '#1e293b', '#059669', '#dc2626', '#7c3aed', '#0891b2', '#ea580c', '#4f46e5', '#be185d', '#65a30d']

export function ReportsPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [period, setPeriod] = useState('monthly')
  const [clientId, setClientId] = useState('')
  const [siteId, setSiteId] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['reports', period, clientId, siteId],
    queryFn: () => {
      const params: Record<string, string> = { period }
      if (clientId) params.clientId = clientId
      if (siteId) params.siteId = siteId
      return api.getReports(params) as Promise<{
        byCategory: Array<{ categoryName: string; total: number; count: number }>
        byMonth: Array<{ month: string; total: number; count: number }>
        bySite: Array<{ siteName: string; clientName: string; total: number; count: number }>
        totalAmount: number
        totalCount: number
        period: string
      }>
    },
  })

  // Fetch clients and sites for filters
  const { data: clients } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => api.getClients() as Promise<Array<{ id: string; name: string }>>,
  })
  const { data: sites } = useQuery({
    queryKey: ['sites-list'],
    queryFn: () => api.getSites() as Promise<Array<{ id: string; name: string; clientId: string }>>,
  })

  const filteredSites = sites?.filter(s => !clientId || s.clientId === clientId) || []

  const handleExportExcel = () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx')
    const rows = (data?.bySite || []).map(r => ({
      'Site': r.siteName,
      'Client': r.clientName,
      'Total Amount (₹)': r.total,
      'Count': r.count,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Report')
    XLSX.writeFile(wb, `report-${period}-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const handleExportPDF = () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { jsPDF } = require('jspdf')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const autoTable = require('jspdf-autotable')

    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(18)
    doc.setTextColor(30, 41, 59)
    doc.text('S.S. Electricals - Expense Report', 14, 22)
    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139)
    doc.text(`Period: ${period} | Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 30)
    doc.text(`Total: ₹${formatCurrency(data?.totalAmount || 0)} | Count: ${data?.totalCount || 0}`, 14, 36)

    if (data?.bySite && data.bySite.length > 0) {
      autoTable(doc, {
        startY: 42,
        head: [['Site', 'Client', 'Total (₹)', 'Count']],
        body: data.bySite.map(r => [r.siteName, r.clientName, formatCurrency(r.total), r.count]),
        headStyles: { fillColor: [30, 41, 59] },
        theme: 'grid',
      })
    }

    doc.save(`report-${period}-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  if (!user || !['ADMIN', 'ACCOUNTANT'].includes(user.role)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">Access denied</p>
      </div>
    )
  }

  const avgPerExpense = data?.totalCount ? data.totalAmount / data.totalCount : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-amber-500" />
            Reports
          </h2>
          <p className="text-sm text-slate-500 mt-1">Expense analytics and breakdowns</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2">
            <FileText className="w-4 h-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="rounded-xl shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="w-full sm:w-40">
              <label className="text-xs text-slate-500 mb-1 block">Period</label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly (12m)</SelectItem>
                  <SelectItem value="quarterly">This Quarter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-48">
              <label className="text-xs text-slate-500 mb-1 block">Client</label>
              <Select value={clientId} onValueChange={(v) => { setClientId(v); setSiteId('') }}>
                <SelectTrigger><SelectValue placeholder="All Clients" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {(clients || []).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-48">
              <label className="text-xs text-slate-500 mb-1 block">Site</label>
              <Select value={siteId} onValueChange={setSiteId}>
                <SelectTrigger><SelectValue placeholder="All Sites" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sites</SelectItem>
                  {filteredSites.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="rounded-xl shadow-sm">
            <CardContent className="p-6">
              <p className="text-xs text-slate-500 uppercase font-medium">Total Amount</p>
              <p className="text-2xl font-bold text-navy-900 mt-1">{formatCurrency(data?.totalAmount || 0)}</p>
              <p className="text-xs text-slate-400 mt-1">{data?.totalCount || 0} expenses</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm">
            <CardContent className="p-6">
              <p className="text-xs text-slate-500 uppercase font-medium">Avg per Expense</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{formatCurrency(avgPerExpense)}</p>
              <p className="text-xs text-slate-400 mt-1">Per transaction</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-sm">
            <CardContent className="p-6">
              <p className="text-xs text-slate-500 uppercase font-medium">Categories</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{data?.byCategory?.length || 0}</p>
              <p className="text-xs text-slate-400 mt-1">Active categories</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Row */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2"><Skeleton className="h-80 rounded-xl" /></div>
          <div><Skeleton className="h-80 rounded-xl" /></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Bar Chart: Monthly */}
          <Card className="rounded-xl shadow-sm lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-navy-900">Monthly Expenses</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {data?.byMonth && data.byMonth.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={data.byMonth} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#64748b" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#64748b" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} labelStyle={{ color: '#1e293b' }} />
                    <Legend />
                    <Bar dataKey="total" name="Amount" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-slate-400">No monthly data</div>
              )}
            </CardContent>
          </Card>

          {/* Pie Chart: By Category */}
          <Card className="rounded-xl shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-navy-900">By Category</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {data?.byCategory && data.byCategory.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={data.byCategory}
                      cx="50%"
                      cy="45%"
                      innerRadius={50}
                      outerRadius={90}
                      dataKey="total"
                      nameKey="categoryName"
                      paddingAngle={2}
                    >
                      {data.byCategory.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend
                      iconSize={10}
                      wrapperStyle={{ fontSize: '11px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-slate-400">No category data</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* By Site Table */}
      <Card className="rounded-xl shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-navy-900">Breakdown by Site</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {isLoading ? (
            <Skeleton className="h-48 rounded-lg" />
          ) : data?.bySite && data.bySite.length > 0 ? (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Site</TableHead>
                    <TableHead className="text-xs">Client</TableHead>
                    <TableHead className="text-xs text-right">Total</TableHead>
                    <TableHead className="text-xs text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.bySite.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium text-sm">{row.siteName}</TableCell>
                      <TableCell className="text-sm text-slate-600">{row.clientName}</TableCell>
                      <TableCell className="text-sm text-right font-semibold text-amber-600">{formatCurrency(row.total)}</TableCell>
                      <TableCell className="text-sm text-right">{row.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">No site data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
