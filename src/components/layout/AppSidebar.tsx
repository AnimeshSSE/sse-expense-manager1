'use client'

import { useAppStore, type PageType } from '@/lib/store'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Receipt,
  ClipboardList,
  Wallet,
  Building2,
  Briefcase,
  Tags,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface NavItem {
  page: PageType
  label: string
  icon: React.ElementType
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { page: 'expenses', label: 'Expenses', icon: Receipt },
  { page: 'requisitions', label: 'Requisitions', icon: ClipboardList },
  { page: 'advances', label: 'Advances', icon: Wallet },
  { page: 'sites', label: 'Sites', icon: Building2, adminOnly: true },
  { page: 'clients', label: 'Clients', icon: Briefcase, adminOnly: true },
  { page: 'categories', label: 'Categories', icon: Tags, adminOnly: true },
  { page: 'users', label: 'Users', icon: Users, adminOnly: true },
  { page: 'settings', label: 'Settings', icon: Settings },
]

interface AppSidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const { currentUser, currentPage, setCurrentPage, setCurrentUser } = useAppStore()

  if (!currentUser) return null

  const user = currentUser
  const roleLabel = user.role.replace(/_/g, ' ')

  const filteredNavItems = navItems.filter(
    (item) => !item.adminOnly || user.role === 'ADMIN'
  )

  return (
    <aside
      className={cn(
        'no-print flex flex-col bg-sidebar text-sidebar-foreground h-screen sticky top-0 transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5">
        <img
          src="/sse-logo.svg"
          alt="SSE"
          className="h-9 w-9 rounded-lg flex-shrink-0"
        />
        {!collapsed && (
          <div className="flex flex-col">
            <span className="font-bold text-lg leading-tight text-sidebar-foreground">
              SSE
            </span>
            <span className="text-xs text-sidebar-foreground/60 leading-tight">
              Expense Manager
            </span>
          </div>
        )}
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {filteredNavItems.map((item) => {
          const isActive = currentPage === item.page
          const Icon = item.icon

          return (
            <button
              key={item.page}
              onClick={() => setCurrentPage(item.page)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          )
        })}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* User Info */}
      <div className="px-3 py-4">
        <div className={cn(
          'flex items-center gap-3 rounded-lg bg-sidebar-accent/30 px-3 py-2.5',
          collapsed && 'justify-center px-0'
        )}>
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
              {user.name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-sidebar-foreground">
                {user.name}
              </p>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-sidebar-border text-sidebar-foreground/60"
              >
                {roleLabel}
              </Badge>
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={() => setCurrentUser(null)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 mt-2 rounded-lg text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors',
            collapsed && 'justify-center px-0'
          )}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

      {/* Collapse Toggle (desktop only) */}
      <div className="hidden lg:block border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="w-full justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          <ChevronLeft
            className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')}
          />
        </Button>
      </div>
    </aside>
  )
}
