'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useLanguage } from '@/hooks/use-language'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  LayoutDashboard, Receipt, Banknote, FileText, Building2, MapPin, Tags,
  Users, UserCircle, Leaf, BarChart3, ScrollText, LogOut, Menu, ChevronDown,
  Globe, AlertTriangle, Settings, ClipboardList,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'

type Page = 'dashboard' | 'expenses' | 'advances' | 'requisitions' | 'boq' | 'clients' | 'sites' | 'categories' | 'users' | 'employees' | 'leaves' | 'reports' | 'audit-logs'

interface NavItem {
  id: Page
  labelKey: string
  icon: React.ReactNode
  roles: string[]
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', labelKey: 'dashboard', icon: <LayoutDashboard className="w-5 h-5" />, roles: ['ADMIN', 'ACCOUNTANT', 'STOCK_MANAGER', 'USER'] },
  { id: 'expenses', labelKey: 'expenses', icon: <Receipt className="w-5 h-5" />, roles: ['ADMIN', 'ACCOUNTANT', 'STOCK_MANAGER', 'USER'] },
  { id: 'advances', labelKey: 'advances', icon: <Banknote className="w-5 h-5" />, roles: ['ADMIN', 'ACCOUNTANT', 'USER'] },
  { id: 'requisitions', labelKey: 'requisitions', icon: <FileText className="w-5 h-5" />, roles: ['ADMIN', 'STOCK_MANAGER', 'USER'] },
  { id: 'boq', labelKey: 'boq', icon: <ClipboardList className="w-5 h-5" />, roles: ['ADMIN', 'STOCK_MANAGER', 'USER'] },
  { id: 'clients', labelKey: 'clients', icon: <Building2 className="w-5 h-5" />, roles: ['ADMIN'] },
  { id: 'sites', labelKey: 'sites', icon: <MapPin className="w-5 h-5" />, roles: ['ADMIN'] },
  { id: 'categories', labelKey: 'categories', icon: <Tags className="w-5 h-5" />, roles: ['ADMIN'] },
  { id: 'users', labelKey: 'users', icon: <Users className="w-5 h-5" />, roles: ['ADMIN'] },
  { id: 'employees', labelKey: 'employees', icon: <UserCircle className="w-5 h-5" />, roles: ['ADMIN', 'USER'] },
  { id: 'leaves', labelKey: 'leaves', icon: <Leaf className="w-5 h-5" />, roles: ['ADMIN', 'USER'] },
  { id: 'reports', labelKey: 'reports', icon: <BarChart3 className="w-5 h-5" />, roles: ['ADMIN', 'ACCOUNTANT'] },
  { id: 'audit-logs', labelKey: 'auditLogs', icon: <ScrollText className="w-5 h-5" />, roles: ['ADMIN'] },
]

function SidebarNav({ currentPage, onNavigate, collapsed }: { currentPage: Page; onNavigate: (p: Page) => void; collapsed: boolean }) {
  const { t } = useLanguage()
  const { user } = useAuth()

  const items = NAV_ITEMS.filter(item => item.roles.includes(user?.role || ''))

  if (collapsed) return null

  return (
    <nav className="flex flex-col gap-1 px-3">
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all w-full text-left',
            currentPage === item.id
              ? 'bg-amber-500/15 text-amber-400 shadow-sm'
              : 'text-navy-300 hover:bg-navy-800 hover:text-white'
          )}
        >
          {item.icon}
          {(t as any)[item.labelKey] || item.labelKey}
        </button>
      ))}
    </nav>
  )
}

function PageContent({ page }: { page: Page }) {
  // Lazy-render pages via dynamic imports to reduce initial bundle
  const { DashboardPage } = require('./dashboard-page')
  const { ExpensesPage } = require('./expenses-page')
  const { AdvancesPage } = require('./advances-page')
  const { RequisitionsPage } = require('./requisitions-page')
  const { BOQPage } = require('./boq-page')
  const { ClientsPage } = require('./clients-page')
  const { SitesPage } = require('./sites-page')
  const { CategoriesPage } = require('./categories-page')
  const { UsersPage } = require('./users-page')
  const { EmployeesPage } = require('./employees-page')
  const { LeavesPage } = require('./leaves-page')
  const { ReportsPage } = require('./reports-page')
  const { AuditLogsPage } = require('./audit-logs-page')

  const pages: Record<Page, React.ComponentType> = {
    dashboard: DashboardPage,
    expenses: ExpensesPage,
    advances: AdvancesPage,
    requisitions: RequisitionsPage,
    boq: BOQPage,
    clients: ClientsPage,
    sites: SitesPage,
    categories: CategoriesPage,
    users: UsersPage,
    employees: EmployeesPage,
    leaves: LeavesPage,
    reports: ReportsPage,
    'audit-logs': AuditLogsPage,
  }

  const Component = pages[page]
  return Component ? <Component /> : null
}

export default function AppShell() {
  const { user, logout } = useAuth()
  const { t, lang, setLang } = useLanguage()
  const queryClient = useQueryClient()
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const handleNavigate = useCallback((page: Page) => {
    setCurrentPage(page)
    queryClient.invalidateQueries()
  }, [queryClient])

  const handleLogout = async () => {
    await logout()
    queryClient.clear()
  }

  const roleName = user?.role === 'STOCK_MANAGER' ? 'Stock Mgr' : (user?.role?.charAt(0) || '') + (user?.role?.slice(1).toLowerCase() || '')

  return (
    <div className="min-h-screen flex bg-navy-50">
      {/* Desktop Sidebar */}
      <aside className={cn(
        'hidden lg:flex flex-col bg-navy-950 text-white transition-all duration-300 border-r border-navy-800',
        sidebarCollapsed ? 'w-[68px]' : 'w-[260px]'
      )}>
        <div className={cn('flex items-center h-16 px-4 border-b border-navy-800', sidebarCollapsed && 'justify-center')}>
          {!sidebarCollapsed && <Logo size="sm" />}
        </div>
        <ScrollArea className="flex-1 py-4">
          <SidebarNav currentPage={currentPage} onNavigate={handleNavigate} collapsed={sidebarCollapsed} />
        </ScrollArea>
        <div className="p-3 border-t border-navy-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="text-navy-400 hover:text-white w-full justify-center"
          >
            <ChevronDown className={cn('w-4 h-4 transition-transform', sidebarCollapsed && 'rotate-90')} />
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-navy-100 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {/* Mobile menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[260px] p-0 bg-navy-950 text-white">
                <div className="flex items-center h-16 px-4 border-b border-navy-800">
                  <Logo size="sm" />
                </div>
                <ScrollArea className="h-[calc(100vh-4rem)] py-4">
                  <SidebarNav currentPage={currentPage} onNavigate={handleNavigate} collapsed={false} />
                </ScrollArea>
              </SheetContent>
            </Sheet>
            <h1 className="text-lg font-semibold text-navy-900">
              {(t as any)[currentPage] || currentPage}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
              className="flex items-center gap-1 text-sm text-navy-500 hover:text-navy-700 transition-colors"
            >
              <Globe className="w-4 h-4" />
              <span className="hidden sm:inline">{lang === 'en' ? 'हिंदी' : 'English'}</span>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 h-9 px-3">
                  <div className="w-8 h-8 rounded-full bg-navy-900 text-white flex items-center justify-center text-xs font-bold">
                    {user?.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="hidden sm:flex flex-col items-start">
                    <span className="text-sm font-medium text-navy-900 leading-tight">{user?.name}</span>
                    <span className="text-[10px] text-navy-500 leading-tight">{roleName}</span>
                  </div>
                  <ChevronDown className="w-3 h-3 text-navy-400 hidden sm:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => handleNavigate('dashboard')} className="cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
                  <LogOut className="w-4 h-4 mr-2" /> {t.logout}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6">
          <PageContent page={currentPage} />
        </main>
      </div>
    </div>
  )
}
