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
import { Shield, LogIn, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function LoginPage() {
  const { setCurrentUser } = useAppStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Login failed')
        return
      }

      // Store token in localStorage
      if (data.token) {
        localStorage.setItem('auth_token', data.token)
      }

      setCurrentUser({
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role as UserRole,
        department: data.user.department || '',
        employeeId: data.user.employeeId || '',
        status: data.user.status as 'ACTIVE' | 'INACTIVE',
      })
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Shield className="h-10 w-10 text-primary" />
            </div>
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
              <LogIn className="h-5 w-5 text-primary" />
              Sign In
            </CardTitle>
            <CardDescription>
              Enter your credentials to access the application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>
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
