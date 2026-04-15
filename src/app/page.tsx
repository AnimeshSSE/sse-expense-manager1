'use client'

import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useAppStore, type UserRole } from '@/lib/store'
import { AppLayout } from '@/components/layout/AppLayout'
import { Dashboard } from '@/components/dashboard/Dashboard'
import { ExpenseList } from '@/components/expenses/ExpenseList'
import { ExpenseForm } from '@/components/expenses/ExpenseForm'
import { ExpenseDetail } from '@/components/expenses/ExpenseDetail'
import { ExpensePrintTemplate } from '@/components/expenses/ExpensePrintTemplate'
import { RequisitionList } from '@/components/requisitions/RequisitionList'
import { RequisitionForm } from '@/components/requisitions/RequisitionForm'
import { RequisitionDetail } from '@/components/requisitions/RequisitionDetail'
import { RequisitionPrintTemplate } from '@/components/requisitions/RequisitionPrintTemplate'
import { AdvanceList } from '@/components/advances/AdvanceList'
import { AdvanceForm } from '@/components/advances/AdvanceForm'
import { AdvanceDetail } from '@/components/advances/AdvanceDetail'
import { AdvancePrintTemplate } from '@/components/advances/AdvancePrintTemplate'
import { SiteList } from '@/components/sites/SiteList'
import { ClientList } from '@/components/clients/ClientList'
import { CategoryList } from '@/components/categories/CategoryList'
import { UserList } from '@/components/users/UserList'
import { Settings } from '@/components/settings/Settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Shield, ArrowRight } from 'lucide-react'

function LoginPage() {
  const { setCurrentUser } = useAppStore()
  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetch('/api/users?limit=50').then(res => res.json()),
  })

  const users = data?.users || []

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <Skeleton className="h-20 w-20 rounded-2xl" />
            </div>
            <Skeleton className="h-8 w-64 mx-auto" />
            <Skeleton className="h-4 w-48 mx-auto" />
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-60" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <img src="/sse-logo.svg" alt="SSE" className="h-20 w-20 rounded-2xl shadow-lg" />
            </div>
            <h1 className="text-3xl font-bold">SSE Expense Manager</h1>
            <p className="text-destructive">Failed to load users. Please try again.</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <img src="/sse-logo.svg" alt="SSE" className="h-20 w-20 rounded-2xl shadow-lg" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">SSE Expense Manager</h1>
            <p className="text-muted-foreground mt-1">
              Streamlined expense management for your organization
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Select Account
            </CardTitle>
            <CardDescription>
              Choose an account to explore the application
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
            {users.map((user: { id: string; name: string; role: string; department: string; email: string; employeeId: string; status: string }) => (
              <Button
                key={user.id}
                variant="outline"
                className="w-full justify-start h-auto py-3 px-4 gap-4 hover:bg-primary/5 hover:border-primary/30"
                onClick={() => setCurrentUser({
                  id: user.id,
                  name: user.name,
                  email: user.email,
                  role: user.role as UserRole,
                  department: user.department || '',
                  employeeId: user.employeeId || '',
                  status: user.status as 'ACTIVE' | 'INACTIVE',
                })}
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {user.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {user.role.replace(/_/g, ' ')} · {user.department || 'No Department'}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Button>
            ))}
            {users.length === 0 && (
              <p className="text-center text-muted-foreground py-4">No users found.</p>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          {users.length} account{users.length !== 1 ? 's' : ''} available
        </p>
      </div>
    </div>
  )
}

function PrintView() {
  const { currentPage } = useAppStore()

  return (
    <div className="min-h-screen bg-white p-4">
      {currentPage === 'expenses' && <ExpensePrintTemplate />}
      {currentPage === 'requisitions' && <RequisitionPrintTemplate />}
      {currentPage === 'advances' && <AdvancePrintTemplate />}
      <div className="no-print mt-4 text-center">
        <Button
          variant="outline"
          onClick={() => {
            useAppStore.getState().setIsPrintMode(false)
            window.close()
          }}
        >
          Back to App
        </Button>
      </div>
    </div>
  )
}

function AppContent() {
  const { currentPage, isPrintMode, expenseFormMode, selectedExpenseId, requisitionFormMode, selectedRequisitionId, advanceFormMode, selectedAdvanceId } = useAppStore()

  if (isPrintMode) {
    return <PrintView />
  }

  return (
    <AppLayout>
      {/* Print templates (hidden, only shown during print) */}
      {currentPage === 'expenses' && <ExpensePrintTemplate />}
      {currentPage === 'requisitions' && <RequisitionPrintTemplate />}
      {currentPage === 'advances' && <AdvancePrintTemplate />}

      {currentPage === 'dashboard' && <Dashboard />}

      {currentPage === 'expenses' && (
        <>
          <ExpenseList
            onCreateNew={() => {
              useAppStore.getState().setExpenseFormMode('create')
              useAppStore.getState().setSelectedExpenseId(null)
            }}
            onViewDetail={(id) => {
              useAppStore.getState().setSelectedExpenseId(id)
              useAppStore.getState().setExpenseFormMode('view')
            }}
          />
          <ExpenseForm />
          {(expenseFormMode === 'view' || expenseFormMode === 'edit') && selectedExpenseId && (
            <ExpenseDetail
              onBack={() => {
                useAppStore.getState().setSelectedExpenseId(null)
                useAppStore.getState().setExpenseFormMode('create')
              }}
              onEdit={() => {
                useAppStore.getState().setExpenseFormMode('edit')
              }}
              onPrint={() => {
                useAppStore.getState().setIsPrintMode(true)
                setTimeout(() => window.print(), 100)
              }}
            />
          )}
        </>
      )}

      {currentPage === 'requisitions' && (
        <>
          <RequisitionList
            onCreateNew={() => {
              useAppStore.getState().setRequisitionFormMode('create')
              useAppStore.getState().setSelectedRequisitionId(null)
            }}
            onViewDetail={(id) => {
              useAppStore.getState().setSelectedRequisitionId(id)
              useAppStore.getState().setRequisitionFormMode('view')
            }}
          />
          <RequisitionForm />
          {(requisitionFormMode === 'view' || requisitionFormMode === 'edit') && selectedRequisitionId && (
            <RequisitionDetail
              onBack={() => {
                useAppStore.getState().setSelectedRequisitionId(null)
                useAppStore.getState().setRequisitionFormMode('create')
              }}
              onEdit={() => {
                useAppStore.getState().setRequisitionFormMode('edit')
              }}
              onPrint={() => {
                useAppStore.getState().setIsPrintMode(true)
                setTimeout(() => window.print(), 100)
              }}
            />
          )}
        </>
      )}

      {currentPage === 'advances' && (
        <>
          <AdvanceList
            onCreateNew={() => {
              useAppStore.getState().setAdvanceFormMode('create')
              useAppStore.getState().setSelectedAdvanceId(null)
            }}
            onViewDetail={(id) => {
              useAppStore.getState().setSelectedAdvanceId(id)
              useAppStore.getState().setAdvanceFormMode('view')
            }}
          />
          <AdvanceForm />
          {(advanceFormMode === 'view' || advanceFormMode === 'edit') && selectedAdvanceId && (
            <AdvanceDetail
              onBack={() => {
                useAppStore.getState().setSelectedAdvanceId(null)
                useAppStore.getState().setAdvanceFormMode('create')
              }}
              onEdit={() => {
                useAppStore.getState().setAdvanceFormMode('edit')
              }}
              onPrint={() => {
                useAppStore.getState().setIsPrintMode(true)
                setTimeout(() => window.print(), 100)
              }}
            />
          )}
        </>
      )}

      {currentPage === 'sites' && <SiteList />}
      {currentPage === 'clients' && <ClientList />}
      {currentPage === 'categories' && <CategoryList />}
      {currentPage === 'users' && <UserList />}
      {currentPage === 'settings' && <Settings />}
    </AppLayout>
  )
}

export default function Home() {
  const { currentUser } = useAppStore()
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  }))

  if (!currentUser) {
    return (
      <QueryClientProvider client={queryClient}>
        <LoginPage />
      </QueryClientProvider>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}
