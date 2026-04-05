'use client'

import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { api } from '@/lib/api'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
}

export interface AuthPermissions {
  canManageUsers: boolean
  canManageClients: boolean
  canManageSites: boolean
  canManageCategories: boolean
  canViewAuditLogs: boolean
  canApproveExpenses: boolean
  canApproveMIRs: boolean
  canManageInventory: boolean
  canExportData: boolean
  canViewAllExpenses: boolean
  canViewAllMirs: boolean
}

interface AuthState {
  user: AuthUser | null
  permissions: AuthPermissions
  isLoading: boolean
  isAuthenticated: boolean
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const defaultPermissions: AuthPermissions = {
  canManageUsers: false,
  canManageClients: false,
  canManageSites: false,
  canManageCategories: false,
  canViewAuditLogs: false,
  canApproveExpenses: false,
  canApproveMIRs: false,
  canManageInventory: false,
  canExportData: false,
  canViewAllExpenses: false,
  canViewAllMirs: false,
}

function mapPermissions(permissionsList: string[]): AuthPermissions {
  return {
    canManageUsers: permissionsList.includes('MANAGE_USERS'),
    canManageClients: permissionsList.includes('MANAGE_CLIENTS'),
    canManageSites: permissionsList.includes('MANAGE_SITES'),
    canManageCategories: permissionsList.includes('MANAGE_CATEGORIES'),
    canViewAuditLogs: permissionsList.includes('VIEW_AUDIT_LOGS'),
    canApproveExpenses: permissionsList.includes('ACCOUNTANT_APPROVE_EXPENSE') || permissionsList.includes('ADMIN_APPROVE_EXPENSE'),
    canApproveMIRs: permissionsList.includes('STOCK_MANAGER_APPROVE_MIR') || permissionsList.includes('ADMIN_APPROVE_MIR'),
    canManageInventory: permissionsList.includes('ORDER_MIR') || permissionsList.includes('RECEIVE_MIR'),
    canExportData: permissionsList.includes('EXPORT_DATA'),
    canViewAllExpenses: permissionsList.includes('VIEW_ALL_EXPENSES'),
    canViewAllMirs: permissionsList.includes('VIEW_ALL_MIRS'),
  }
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  permissions: defaultPermissions,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    permissions: defaultPermissions,
    isLoading: true,
    isAuthenticated: false,
  })

  const refreshUser = useCallback(async () => {
    try {
      const result = await api.getMe()
      const perms = mapPermissions(result.permissions || [])
      setState({
        user: result.user,
        permissions: perms,
        isLoading: false,
        isAuthenticated: true,
      })
    } catch {
      setState({
        user: null,
        permissions: defaultPermissions,
        isLoading: false,
        isAuthenticated: false,
      })
    }
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password)
    const perms = mapPermissions(result.permissions || [])
    setState({
      user: result.user,
      permissions: perms,
      isLoading: false,
      isAuthenticated: true,
    })
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      setState({
        user: null,
        permissions: defaultPermissions,
        isLoading: false,
        isAuthenticated: false,
      })
    }
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}
