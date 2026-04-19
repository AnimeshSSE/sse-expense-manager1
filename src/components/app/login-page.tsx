'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/hooks/use-language'
import { Eye, EyeOff, Globe } from 'lucide-react'

export default function LoginPage() {
  const { login } = useAuth()
  const { t, lang, setLang } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      </div>

      {/* Language toggle */}
      <button
        onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
        className="absolute top-6 right-6 flex items-center gap-2 text-navy-300 hover:text-amber-400 transition-colors text-sm"
      >
        <Globe className="w-4 h-4" />
        {lang === 'en' ? 'हिंदी' : 'English'}
      </button>

      <Card className="w-full max-w-md border-navy-700 bg-navy-900/80 backdrop-blur-xl shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="bg-amber-500 text-white rounded-xl p-3 shadow-lg shadow-amber-500/20">
              <Logo size="sm" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white">{t.appName}</CardTitle>
          <CardDescription className="text-navy-300">{t.subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-navy-200">{t.email}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@ss-electricals.com"
                required
                className="bg-navy-800 border-navy-600 text-white placeholder:text-navy-500 focus:border-amber-500 focus:ring-amber-500/20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-navy-200">{t.password}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="bg-navy-800 border-navy-600 text-white placeholder:text-navy-500 focus:border-amber-500 focus:ring-amber-500/20 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-500 hover:text-navy-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-600 text-navy-950 font-semibold h-11 transition-all"
            >
              {loading ? t.loading + '...' : t.loginButton}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
