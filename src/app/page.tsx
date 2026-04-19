'use client'

import { useAuth } from '@/hooks/use-auth'
import LoginPage from '@/components/app/login-page'
import AppShell from '@/components/app/app-shell'
import { Skeleton } from '@/components/ui/skeleton'

export default function Home() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-50">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="w-48 h-12 rounded-lg" />
          <Skeleton className="w-32 h-4 rounded" />
        </div>
      </div>
    )
  }

  if (!user) return <LoginPage />
  return <AppShell />
}
