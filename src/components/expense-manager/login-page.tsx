'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Receipt, Loader2, Eye, EyeOff } from 'lucide-react'

export function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await login(email, password)
    } catch {
      // Error handled by api client
    } finally {
      setIsLoading(false)
    }
  }

  const demoCredentials = [
    { email: 'admin@demo.com', password: 'admin123', role: 'Admin', color: 'bg-red-100 text-red-800 border-red-200' },
    { email: 'accountant@demo.com', password: 'accountant123', role: 'Accountant', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
    { email: 'stock@demo.com', password: 'stock123', role: 'Stock Manager', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    { email: 'user@demo.com', password: 'user123', role: 'User', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  ]

  const handleDemoLogin = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail)
    setPassword(demoPassword)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo and title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-stone-900 text-white shadow-lg">
            <Receipt className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900">SSE Expense Manager</h1>
          <p className="text-stone-500 text-sm">Sign in to your account to continue</p>
        </div>

        {/* Login form */}
        <Card className="shadow-lg border-stone-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Sign In</CardTitle>
            <CardDescription>Enter your credentials below</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4 text-stone-400" /> : <Eye className="h-4 w-4 text-stone-400" />}
                  </Button>
                </div>
              </div>
              <Button type="submit" className="w-full bg-stone-900 hover:bg-stone-800" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Demo credentials */}
        <Card className="shadow-sm border-stone-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Demo Credentials</CardTitle>
            <CardDescription className="text-xs">Click to auto-fill credentials</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {demoCredentials.map((cred) => (
                <button
                  key={cred.email}
                  type="button"
                  onClick={() => handleDemoLogin(cred.email, cred.password)}
                  className={`text-left p-3 rounded-lg border transition-all hover:shadow-sm ${cred.color}`}
                >
                  <div className="font-medium text-xs">{cred.role}</div>
                  <div className="text-xs opacity-75 mt-0.5 truncate">{cred.email}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
