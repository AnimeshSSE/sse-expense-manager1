'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useLanguage } from '@/hooks/use-language'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { api } from '@/lib/api'
import {
  Receipt,
  LayoutDashboard,
  ReceiptText,
  Package,
  ClipboardList,
  Users,
  Building2,
  MapPin,
  Tags,
  FileText,
  Menu,
  LogOut,
  ChevronRight,
  Shield,

  Banknote,
  BarChart3,
  Bell,
} from 'lucide-react'
import type { ReactNode } from 'react'

export type TabId =
  | 'dashboard'
  | 'expenses'
  | 'advances'
  | 'requisitions'
  | 'boq'
  | 'reports'
  | 'clients'
  | 'sites'
  | 'categories'
  | 'users'
  | 'audit-logs'

interface NavItem {
  id: TabId
  labelKey: string
  icon: ReactNode
  adminOnly?: boolean
  auditLogAccess?: boolean
}

interface LayoutProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  children: ReactNode
}

const roleColors: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-800',
  ACCOUNTANT: 'bg-cyan-100 text-cyan-800',
  STOCK_MANAGER: 'bg-emerald-100 text-emerald-800',
  USER: 'bg-stone-100 text-stone-800',
}

const roleLabels: Record<string, string> = {
  ADMIN: 'Admin',
  ACCOUNTANT: 'Accountant',
  STOCK_MANAGER: 'Stock Mgr',
  USER: 'User',
}

function NotificationBell() {
  const { user, permissions } = useAuth()
  const [counts, setCounts] = useState({
    pendingExpenses: 0,
    returnedExpenses: 0,
    pendingAdvances: 0,
    pendingApprovals: 0,
  })
  const total = counts.pendingExpenses + counts.returnedExpenses + counts.pendingAdvances + counts.pendingApprovals

  useEffect(() => {
    async function fetchCounts() {
      try {
        const baseExpenseParams = { limit: '1' }
        const userExpenseParams = user?.id ? { ...baseExpenseParams, userId: user.id } : baseExpenseParams
        const [pendingExp, returnedExp, pendingAdv] = await Promise.all([
          api.getExpenses({ status: 'PENDING', ...userExpenseParams }),
          api.getExpenses({ status: 'RETURNED', ...userExpenseParams }),
          api.getAdvances({ status: 'PENDING', limit: '1' }),
        ])
        const newCounts: Record<string, number> = {
          pendingExpenses: pendingExp?.total || 0,
          returnedExpenses: returnedExp?.total || 0,
          pendingAdvances: pendingAdv?.total || 0,
          pendingApprovals: 0,
        }
        // For accountant/admin: pending approvals
        if (user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT') {
          const [pendingApproval] = await Promise.all([
            api.getExpenses({ status: 'PENDING', limit: '1' }),
          ])
          newCounts.pendingApprovals = (pendingApproval?.total || 0) + newCounts.pendingAdvances
        }
        setCounts(newCounts as typeof counts)
      } catch {
        // handled
      }
    }
    fetchCounts()
  }, [user?.id, user?.role])

  const items: { label: string; count: number }[] = []
  if (counts.pendingExpenses > 0) items.push({ label: `${counts.pendingExpenses} pending expense${counts.pendingExpenses !== 1 ? 's' : ''}`, count: counts.pendingExpenses })
  if (counts.returnedExpenses > 0) items.push({ label: `${counts.returnedExpenses} returned expense${counts.returnedExpenses !== 1 ? 's' : ''}`, count: counts.returnedExpenses })
  if (counts.pendingAdvances > 0) items.push({ label: `${counts.pendingAdvances} pending advance${counts.pendingAdvances !== 1 ? 's' : ''}`, count: counts.pendingAdvances })
  if (counts.pendingApprovals > 0 && (user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT')) items.push({ label: `${counts.pendingApprovals} pending approval${counts.pendingApprovals !== 1 ? 's' : ''}`, count: counts.pendingApprovals })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 relative">
          <Bell className="w-4 h-4" />
          {total > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
              {total > 99 ? '99+' : total}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Notifications</div>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">No new notifications</div>
        ) : (
          items.map((item, i) => (
            <DropdownMenuItem key={i} className="text-xs cursor-pointer">
              <span className="flex-1">{item.label}</span>
              <Badge className="bg-stone-100 text-stone-700 text-[10px] ml-2">{item.count}</Badge>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LanguageSelector() {
  const { language, setLanguage } = useLanguage()

  return (
    <Select value={language} onValueChange={(v) => setLanguage(v as 'en' | 'hi')}>
      <SelectTrigger className="h-8 w-16 text-xs border-0 shadow-none focus:ring-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="en" className="text-xs">EN</SelectItem>
        <SelectItem value="hi" className="text-xs">हिं</SelectItem>
      </SelectContent>
    </Select>
  )
}

function SidebarContent({
  activeTab,
  onTabChange,
  onClose,
}: {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  onClose?: () => void
}) {
  const { user, permissions } = useAuth()
  const { t } = useLanguage()

  const navItems: NavItem[] = [
    { id: 'dashboard', labelKey: 'nav.dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'expenses', labelKey: 'nav.expenses', icon: <ReceiptText className="w-4 h-4" /> },
    { id: 'advances', labelKey: 'nav.advances', icon: <Banknote className="w-4 h-4" /> },
    { id: 'requisitions', labelKey: 'nav.requisitions', icon: <Package className="w-4 h-4" /> },
    { id: 'boq', labelKey: 'nav.boq', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'reports', labelKey: 'nav.reports', icon: <BarChart3 className="w-4 h-4" /> },
  ]

  const adminItems: NavItem[] = [
    { id: 'clients', labelKey: 'nav.clients', icon: <Building2 className="w-4 h-4" /> },
    { id: 'sites', labelKey: 'nav.sites', icon: <MapPin className="w-4 h-4" /> },
    { id: 'categories', labelKey: 'nav.categories', icon: <Tags className="w-4 h-4" /> },
    { id: 'users', labelKey: 'nav.users', icon: <Users className="w-4 h-4" /> },
  ]

  const auditItem: NavItem[] = [
    { id: 'audit-logs', labelKey: 'nav.auditLogs', icon: <FileText className="w-4 h-4" /> },
  ]

  const handleNav = (id: TabId) => {
    onTabChange(id)
    onClose?.()
  }

  return (
    <div className="flex flex-col h-full">
      {/* App header */}
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-stone-900 text-white">
          <Receipt className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-sm text-foreground truncate">SSE Expense Manager</h1>
          <p className="text-xs text-muted-foreground truncate">{t('header.managementPortal')}</p>
        </div>
      </div>

      <Separator />

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-2">
            {t('nav.mainMenu')}
          </p>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeTab === item.id
                  ? 'bg-stone-900 text-white font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              {item.icon}
              <span className="flex-1 text-left">{t(item.labelKey)}</span>
              {activeTab === item.id && <ChevronRight className="w-3 h-3 opacity-50" />}
            </button>
          ))}

          {(permissions.canManageUsers || permissions.canManageClients || permissions.canManageSites || permissions.canManageCategories) && (
            <>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-2 mt-6">
                {t('nav.administration')}
              </p>
              {adminItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeTab === item.id
                      ? 'bg-stone-900 text-white font-medium'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  {item.icon}
                  <span className="flex-1 text-left">{t(item.labelKey)}</span>
                  {activeTab === item.id && <ChevronRight className="w-3 h-3 opacity-50" />}
                </button>
              ))}
            </>
          )}

          {permissions.canViewAuditLogs && (
            <>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-2 mt-6">
                {t('nav.system')}
              </p>
              {auditItem.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeTab === item.id
                      ? 'bg-stone-900 text-white font-medium'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  {item.icon}
                  <span className="flex-1 text-left">{t(item.labelKey)}</span>
                  {activeTab === item.id && <ChevronRight className="w-3 h-3 opacity-50" />}
                </button>
              ))}
            </>
          )}
        </div>
      </ScrollArea>

      {/* User info */}
      <Separator />
      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-muted-foreground text-xs font-bold">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <Badge className={`text-[10px] px-1.5 py-0 ${roleColors[user?.role || 'USER'] || ''}`}>
            {roleLabels[user?.role || 'USER'] || 'User'}
          </Badge>
        </div>
      </div>
    </div>
  )
}

export function Layout({ activeTab, onTabChange, children }: LayoutProps) {
  const { logout } = useAuth()
  const { t } = useLanguage()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
    } finally {
      setLoggingOut(false)
    }
  }

  const tabLabels: Record<TabId, string> = {
    dashboard: t('nav.dashboard'),
    expenses: t('nav.expenses'),
    advances: t('nav.advances'),
    requisitions: t('nav.requisitions'),
    boq: t('nav.boq'),
    reports: t('nav.reports'),
    clients: t('nav.clients'),
    sites: t('nav.sites'),
    categories: t('nav.categories'),
    users: t('nav.users'),
    'audit-logs': t('nav.auditLogs'),
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r bg-card">
        <SidebarContent activeTab={activeTab} onTabChange={onTabChange} />
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="sticky top-0 z-30 flex items-center gap-4 h-14 px-4 lg:px-6 border-b bg-card">
          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SidebarContent
                activeTab={activeTab}
                onTabChange={onTabChange}
                onClose={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>

          {/* Breadcrumb / page title */}
          <div className="flex items-center gap-2 flex-1">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">{tabLabels[activeTab]}</h2>
          </div>

          {/* Notification bell */}
          <NotificationBell />

          {/* Language selector */}
          <LanguageSelector />

          {/* Logout */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-muted-foreground hover:text-destructive"
          >
            <LogOut className="w-4 h-4 mr-2" />
            {t('header.logout')}
          </Button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t bg-card px-4 py-2">
          <p className="text-xs text-muted-foreground text-center">
            SSE Expense Manager &copy; {new Date().getFullYear()} &mdash; {t('misc.poweredBy')}
          </p>
        </footer>
      </div>
    </div>
  )
}
