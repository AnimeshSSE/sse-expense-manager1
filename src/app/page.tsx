'use client'
// S.S. Electricals Expense Manager - v1.2 (Lazy-loaded pages for memory efficiency)

import { useState, lazy, Suspense } from 'react'
import { AuthProvider, useAuth } from '@/hooks/use-auth'
import { LoginPage } from '@/components/expense-manager/login-page'
import { Layout, type TabId } from '@/components/expense-manager/layout'
import { Skeleton } from '@/components/ui/skeleton'

// Lazy-load all page components to reduce initial compilation memory
const DashboardPage = lazy(() => import('@/components/expense-manager/dashboard-page').then(m => ({ default: m.DashboardPage })))
const ExpensesPage = lazy(() => import('@/components/expense-manager/expenses-page').then(m => ({ default: m.ExpensesPage })))
const AdvancesPage = lazy(() => import('@/components/expense-manager/advances-page').then(m => ({ default: m.AdvancesPage })))
const RequisitionsPage = lazy(() => import('@/components/expense-manager/requisitions-page').then(m => ({ default: m.RequisitionsPage })))
const BoqPage = lazy(() => import('@/components/expense-manager/boq-page').then(m => ({ default: m.BoqPage })))
const ReportsPage = lazy(() => import('@/components/expense-manager/reports-page').then(m => ({ default: m.ReportsPage })))
const ClientsPage = lazy(() => import('@/components/expense-manager/clients-page').then(m => ({ default: m.ClientsPage })))
const SitesPage = lazy(() => import('@/components/expense-manager/sites-page').then(m => ({ default: m.SitesPage })))
const CategoriesPage = lazy(() => import('@/components/expense-manager/categories-page').then(m => ({ default: m.CategoriesPage })))
const UsersPage = lazy(() => import('@/components/expense-manager/users-page').then(m => ({ default: m.UsersPage })))
const AuditLogsPage = lazy(() => import('@/components/expense-manager/audit-logs-page').then(m => ({ default: m.AuditLogsPage })))
const EmployeesPage = lazy(() => import('@/components/expense-manager/employees-page').then(m => ({ default: m.EmployeesPage })))

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-3">
        <Skeleton className="w-12 h-12 rounded-xl mx-auto" />
        <Skeleton className="w-36 h-5 mx-auto" />
        <Skeleton className="w-24 h-4 mx-auto" />
        <p className="text-sm text-muted-foreground mt-2">Loading...</p>
      </div>
    </div>
  )
}

function AppContent() {
  const { isAuthenticated, isLoading, permissions } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100">
        <div className="text-center space-y-4">
          <Skeleton className="w-16 h-16 rounded-2xl mx-auto" />
          <Skeleton className="w-48 h-6 mx-auto" />
          <Skeleton className="w-32 h-4 mx-auto" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Suspense fallback={<PageLoader />}>
            <DashboardPage onNavigate={handleTabChange} />
          </Suspense>
        )
      case 'expenses':
        return (
          <Suspense fallback={<PageLoader />}>
            <ExpensesPage />
          </Suspense>
        )
      case 'advances':
        return (
          <Suspense fallback={<PageLoader />}>
            <AdvancesPage />
          </Suspense>
        )
      case 'requisitions':
        return (
          <Suspense fallback={<PageLoader />}>
            <RequisitionsPage />
          </Suspense>
        )
      case 'boq':
        return (
          <Suspense fallback={<PageLoader />}>
            <BoqPage />
          </Suspense>
        )
      case 'reports':
        return (
          <Suspense fallback={<PageLoader />}>
            <ReportsPage />
          </Suspense>
        )
      case 'clients':
        return permissions.canManageClients ? (
          <Suspense fallback={<PageLoader />}>
            <ClientsPage />
          </Suspense>
        ) : null
      case 'sites':
        return permissions.canManageSites ? (
          <Suspense fallback={<PageLoader />}>
            <SitesPage />
          </Suspense>
        ) : null
      case 'categories':
        return permissions.canManageCategories ? (
          <Suspense fallback={<PageLoader />}>
            <CategoriesPage />
          </Suspense>
        ) : null
      case 'users':
        return permissions.canManageUsers ? (
          <Suspense fallback={<PageLoader />}>
            <UsersPage />
          </Suspense>
        ) : null
      case 'audit-logs':
        return permissions.canViewAuditLogs ? (
          <Suspense fallback={<PageLoader />}>
            <AuditLogsPage />
          </Suspense>
        ) : null
      case 'employees':
        return (
          <Suspense fallback={<PageLoader />}>
            <EmployeesPage />
          </Suspense>
        )
      default:
        return (
          <Suspense fallback={<PageLoader />}>
            <DashboardPage onNavigate={handleTabChange} />
          </Suspense>
        )
    }
  }

  return (
    <Layout activeTab={activeTab} onTabChange={handleTabChange}>
      {renderTab()}
    </Layout>
  )
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
