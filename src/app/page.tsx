'use client'

import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Shield, ArrowRight, Loader2 } from 'lucide-react'

type LoginUser = {
  id: string
  name: string
  role: string
  department: string | null
  email: string
  employeeId: string | null
  status: string
}

type UsersResponse = {
  users: LoginUser[]
}

function LoginPage() {
  const { setCurrentUser } = useAppStore()
  const queryClient = useQueryClient()
  const [setupForm, setSetupForm] = useState({
    name: '',
    email: '',
    department: '',
  })
  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: async (): Promise<UsersResponse> => {
      const res = await fetch('/api/users?limit=50')
      const json = await res.json()

      if (!res.ok) {
        throw new Error(json?.error || 'Failed to load users')
      }

      return json
    },
  })

  const users = data?.users || []

  const createAdminMutation = useMutation({
    mutationFn: async () => {
      const name = setupForm.name.trim()
      const email = setupForm.email.trim()

      if (!name || !email) {
        throw new Error('Name and email are required')
      }

      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          department: setupForm.department.trim() || null,
          role: 'ADMIN',
          status: 'ACTIVE',
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json?.error || 'Failed to create the first admin account')
      }

      return json.user as LoginUser
    },
    onSuccess: (user) => {
      queryClient.setQueryData<UsersResponse>(['users'], { users: [user] })
      setCurrentUser({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as UserRole,
        department: user.department || '',
        employeeId: user.employeeId || '',
        status: user.status as 'ACTIVE' | 'INACTIVE',
      })
    },
  })

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
            <p className="text-destructive">
              {error instanceof Error ? error.message : 'Failed to load users. Please try again.'}
            </p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      </div>
    )
  }

  if (users.length === 0) {
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
              <CardTitle>Create First Admin</CardTitle>
              <CardDescription>
                No accounts exist yet. Create the first admin account to start using the application.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="setup-name">Name</Label>
                <Input
                  id="setup-name"
                  value={setupForm.name}
                  onChange={(event) => setSetupForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Admin name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup-email">Email</Label>
                <Input
                  id="setup-email"
                  type="email"
                  value={setupForm.email}
                  onChange={(event) => setSetupForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="admin@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup-department">Department</Label>
                <Input
                  id="setup-department"
                  value={setupForm.department}
                  onChange={(event) => setSetupForm((current) => ({ ...current, department: event.target.value }))}
                  placeholder="Finance"
                />
              </div>
              {createAdminMutation.error instanceof Error && (
                <p className="text-sm text-destructive">{createAdminMutation.error.message}</p>
              )}
              <Button
                className="w-full"
                onClick={() => createAdminMutation.mutate()}
                disabled={createAdminMutation.isPending}
              >
                {createAdminMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Admin Account
              </Button>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">0 accounts available</p>
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
