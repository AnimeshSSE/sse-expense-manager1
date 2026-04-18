'use client'

import { toast } from '@/hooks/use-toast'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || ''

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${BASE_URL}${endpoint}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    }

    // For GET/HEAD requests, don't set Content-Type to allow browser defaults
    if (!options.body && (options.method === 'GET' || options.method === 'HEAD')) {
      delete headers['Content-Type']
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const message =
          errorData.error || errorData.message || `Request failed: ${response.statusText}`
        throw new Error(message)
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return undefined as T
      }

      return await response.json()
    } catch (error) {
      if (error instanceof Error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        })
      }
      throw error
    }
  }

  // Auth
  async login(email: string, password: string) {
    return this.request<{ user: any; permissions: string[] }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  async logout() {
    return this.request('/api/auth/logout', { method: 'POST' })
  }

  async getMe() {
    return this.request<{ user: any; permissions: string[] }>('/api/auth/me')
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
  }

  // Users
  async getUsers(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : ''
    const res = await this.request<{ users: any[] }>(`/api/users${query}`)
    return res?.users || []
  }

  async getUser(id: string) {
    return this.request<any>(`/api/users/${id}`)
  }

  async createUser(data: Record<string, any>) {
    return this.request<any>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateUser(id: string, data: Record<string, any>) {
    return this.request<any>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteUser(id: string) {
    return this.request(`/api/users/${id}`, { method: 'DELETE' })
  }

  // Clients
  async getClients() {
    const res = await this.request<{ clients: any[] }>('/api/clients')
    return res?.clients || []
  }

  async getClient(id: string) {
    return this.request<any>(`/api/clients/${id}`)
  }

  async createClient(data: Record<string, any>) {
    return this.request<any>('/api/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateClient(id: string, data: Record<string, any>) {
    return this.request<any>(`/api/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteClient(id: string) {
    return this.request(`/api/clients/${id}`, { method: 'DELETE' })
  }

  // Sites
  async getSites(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : ''
    const res = await this.request<{ sites: any[] }>(`/api/sites${query}`)
    return res?.sites || []
  }

  async getSite(id: string) {
    return this.request<any>(`/api/sites/${id}`)
  }

  async createSite(data: Record<string, any>) {
    return this.request<any>('/api/sites', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateSite(id: string, data: Record<string, any>) {
    return this.request<any>(`/api/sites/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteSite(id: string) {
    return this.request(`/api/sites/${id}`, { method: 'DELETE' })
  }

  // Categories
  async getCategories(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : ''
    const res = await this.request<{ categories: any[] }>(`/api/categories${query}`)
    return res?.categories || []
  }

  async createCategory(data: Record<string, any>) {
    return this.request<any>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateCategory(id: string, data: Record<string, any>) {
    return this.request<any>(`/api/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteCategory(id: string) {
    return this.request(`/api/categories/${id}`, { method: 'DELETE' })
  }

  // Expenses
  async getExpenses(params?: Record<string, string>) {
    // Map page param names to API param names
    const mapped: Record<string, string> = {}
    if (params?.page) mapped.page = params.page
    if (params?.limit) mapped.pageSize = params.limit
    if (params?.sort) mapped.sortBy = params.sort
    if (params?.sortDir) mapped.sortOrder = params.sortDir
    if (params?.status) mapped.status = params.status
    if (params?.clientId) mapped.clientId = params.clientId
    if (params?.siteId) mapped.siteIds = params.siteId
    if (params?.categoryId) mapped.categoryIds = params.categoryId
    if (params?.paymentMethod) mapped.paymentMethods = params.paymentMethod
    if (params?.dateFrom) mapped.dateFrom = params.dateFrom
    if (params?.dateTo) mapped.dateTo = params.dateTo
    if (params?.amountMin) mapped.amountFrom = params.amountMin
    if (params?.amountMax) mapped.amountTo = params.amountMax
    if (params?.lateOnly) mapped.lateOnly = params.lateOnly
    if (params?.search) mapped.search = params.search
    const query = Object.keys(mapped).length ? '?' + new URLSearchParams(mapped).toString() : ''
    const res = await this.request<{ expenses: any[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>(
      `/api/expenses${query}`
    )
    return {
      data: res?.expenses || [],
      total: res?.pagination?.total || 0,
      page: res?.pagination?.page || 1,
      totalPages: res?.pagination?.totalPages || 1,
    }
  }

  async getExpense(id: string) {
    return this.request<any>(`/api/expenses/${id}`)
  }

  async createExpense(data: Record<string, any>) {
    return this.request<any>('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateExpense(id: string, data: Record<string, any>) {
    return this.request<any>(`/api/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteExpense(id: string) {
    return this.request(`/api/expenses/${id}`, { method: 'DELETE' })
  }

  async approveAccountant(id: string) {
    return this.request(`/api/expenses/${id}/approve-accountant`, { method: 'POST' })
  }

  async approveAdmin(id: string) {
    return this.request(`/api/expenses/${id}/approve-admin`, { method: 'POST' })
  }

  async rejectExpense(id: string, reason: string) {
    return this.request(`/api/expenses/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  }

  async returnExpense(id: string, reason: string) {
    return this.request(`/api/expenses/${id}/return`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  }

  async markPaid(id: string) {
    return this.request(`/api/expenses/${id}/mark-paid`, { method: 'POST' })
  }

  async resubmitExpense(id: string, data: Record<string, any>) {
    return this.request(`/api/expenses/${id}/resubmit`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Requisitions
  async getRequisitions(params?: Record<string, string>) {
    // Map page param names to API param names
    const mapped: Record<string, string> = {}
    if (params?.page) mapped.page = params.page
    if (params?.limit) mapped.pageSize = params.limit
    if (params?.sort) mapped.sortBy = params.sort
    if (params?.sortDir) mapped.sortOrder = params.sortDir
    if (params?.status) mapped.status = params.status
    if (params?.clientId) mapped.clientId = params.clientId
    if (params?.siteId) mapped.siteIds = params.siteId
    if (params?.priority) mapped.priority = params.priority
    if (params?.dateFrom) mapped.dateFrom = params.dateFrom
    if (params?.dateTo) mapped.dateTo = params.dateTo
    if (params?.search) mapped.search = params.search
    const query = Object.keys(mapped).length ? '?' + new URLSearchParams(mapped).toString() : ''
    const res = await this.request<{ requisitions: any[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>(
      `/api/requisitions${query}`
    )
    return {
      data: res?.requisitions || [],
      total: res?.pagination?.total || 0,
      page: res?.pagination?.page || 1,
      totalPages: res?.pagination?.totalPages || 1,
    }
  }

  async getRequisition(id: string) {
    return this.request<any>(`/api/requisitions/${id}`)
  }

  async createRequisition(data: Record<string, any>) {
    return this.request<any>('/api/requisitions', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateRequisition(id: string, data: Record<string, any>) {
    return this.request<any>(`/api/requisitions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteRequisition(id: string) {
    return this.request(`/api/requisitions/${id}`, { method: 'DELETE' })
  }

  async approveStockManager(id: string) {
    return this.request(`/api/requisitions/${id}/approve-stock-manager`, { method: 'POST' })
  }

  async approveAdminRequisition(id: string) {
    return this.request(`/api/requisitions/${id}/approve-admin`, { method: 'POST' })
  }

  async rejectRequisition(id: string, reason: string) {
    return this.request(`/api/requisitions/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  }

  async returnRequisition(id: string, reason: string) {
    return this.request(`/api/requisitions/${id}/return`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  }

  async orderRequisition(id: string) {
    return this.request(`/api/requisitions/${id}/order`, { method: 'POST' })
  }

  async receiveRequisition(id: string) {
    return this.request(`/api/requisitions/${id}/receive`, { method: 'POST' })
  }

  async resubmitRequisition(id: string, data: Record<string, any>) {
    return this.request(`/api/requisitions/${id}/resubmit`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Bulk Actions
  async bulkExpenseAction(ids: string[], action: string) {
    return this.request<{ success: boolean; updatedCount: number; totalRequested: number; errors?: string[] }>(
      '/api/expenses/bulk-action',
      { method: 'POST', body: JSON.stringify({ ids, action }) }
    )
  }

  async bulkRequisitionAction(ids: string[], action: string) {
    return this.request<{ success: boolean; updatedCount: number; totalRequested: number; errors?: string[] }>(
      '/api/requisitions/bulk-action',
      { method: 'POST', body: JSON.stringify({ ids, action }) }
    )
  }

  // Late Submissions
  async getLateSubmissions(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : ''
    return this.request<any>(`/api/dashboard/late-submissions${query}`)
  }

  // BOQ
  async getBoqItems(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : ''
    const res = await this.request<{ items: any[] }>(`/api/boq${query}`)
    return res?.items || []
  }

  // Dashboard
  async getDashboard(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : ''
    return this.request<any>(`/api/dashboard${query}`)
  }

  async getExpenseStats(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : ''
    return this.request<any>(`/api/dashboard/expense-stats${query}`)
  }

  // Audit Logs
  async getAuditLogs(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : ''
    const res = await this.request<{ logs: any[]; pagination: any }>(`/api/audit-logs${query}`)
    return res || { logs: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }
  }

  // Advances
  async getAdvances(params?: Record<string, string>) {
    const mapped: Record<string, string> = {}
    if (params?.page) mapped.page = params.page
    if (params?.limit) mapped.pageSize = params.limit
    if (params?.sort) mapped.sortBy = params.sort
    if (params?.sortDir) mapped.sortOrder = params.sortDir
    if (params?.status) mapped.status = params.status
    if (params?.userId) mapped.userId = params.userId
    if (params?.siteId) mapped.siteId = params.siteId
    if (params?.clientId) mapped.clientId = params.clientId
    if (params?.search) mapped.search = params.search
    if (params?.dateFrom) mapped.dateFrom = params.dateFrom
    if (params?.dateTo) mapped.dateTo = params.dateTo
    if (params?.month) mapped.month = params.month
    const query = Object.keys(mapped).length ? '?' + new URLSearchParams(mapped).toString() : ''
    const res = await this.request<{ advances: any[]; pagination: any }>(`/api/advances${query}`)
    return {
      data: res?.advances || [],
      total: res?.pagination?.total || 0,
      page: res?.pagination?.page || 1,
      totalPages: res?.pagination?.totalPages || 1,
    }
  }

  async createAdvance(data: Record<string, any>) {
    return this.request<any>('/api/advances', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateAdvance(id: string, data: Record<string, any>) {
    return this.request<any>(`/api/advances/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteAdvance(id: string) {
    return this.request(`/api/advances/${id}`, { method: 'DELETE' })
  }

  async approveAdvanceAccountant(id: string) {
    return this.request(`/api/advances/${id}/approve-accountant`, { method: 'POST' })
  }

  async approveAdvanceAdmin(id: string) {
    return this.request(`/api/advances/${id}/approve-admin`, { method: 'POST' })
  }

  async rejectAdvance(id: string, reason: string) {
    return this.request(`/api/advances/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  }

  async returnAdvance(id: string, reason: string) {
    return this.request(`/api/advances/${id}/return`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  }

  async markAdvancePaid(id: string) {
    return this.request(`/api/advances/${id}/mark-paid`, { method: 'POST' })
  }

  // User Balances (via /api/dashboard?view=balances)
  async getUserBalances(params?: Record<string, string>) {
    const mapped: Record<string, string> = { view: 'balances' }
    if (params?.clientId) mapped.clientId = params.clientId
    if (params?.siteId) mapped.siteId = params.siteId
    if (params?.month) mapped.month = params.month
    if (params?.userId) mapped.userId = params.userId
    const query = '?' + new URLSearchParams(mapped).toString()
    const res = await this.request<{ balances: any[] }>(`/api/dashboard${query}`)
    return res?.balances || []
  }

  // Comments
  async getComments(entityType: string, entityId: string) {
    const res = await this.request<{ comments: any[] }>(`/api/comments?entityType=${entityType}&entityId=${entityId}`)
    return res?.comments || []
  }

  async addComment(entityType: string, entityId: string, content: string) {
    return this.request<any>('/api/comments', {
      method: 'POST',
      body: JSON.stringify({ entityType, entityId, content }),
    })
  }

  // Reports
  async getReports(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : ''
    return this.request<any>(`/api/dashboard/reports${query}`)
  }

  // Seed
  async seed() {
    return this.request('/api/seed', { method: 'POST' })
  }

  // ==================== HR / Employee Module ====================

  // Employees
  async getEmployees(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : ''
    const res = await this.request<{ employees: any[] }>(`/api/employees${query}`)
    return res?.employees || []
  }

  async getEmployee(id: string) {
    return this.request<any>(`/api/employees/${id}`)
  }

  async createEmployee(data: Record<string, any>) {
    return this.request<any>('/api/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateEmployee(id: string, data: Record<string, any>) {
    return this.request<any>(`/api/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteEmployee(id: string) {
    return this.request(`/api/employees/${id}`, { method: 'DELETE' })
  }

  // Salaries
  async getSalaries(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : ''
    const res = await this.request<{ salaries: any[]; pagination: any }>(`/api/salaries${query}`)
    return {
      data: res?.salaries || [],
      total: res?.pagination?.total || 0,
      page: res?.pagination?.page || 1,
      totalPages: res?.pagination?.totalPages || 1,
    }
  }

  async createSalary(data: Record<string, any>) {
    return this.request<any>('/api/salaries', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateSalary(id: string, data: Record<string, any>) {
    return this.request<any>(`/api/salaries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async markSalaryPaid(id: string, paidDate?: string) {
    return this.request<any>(`/api/salaries/${id}/mark-paid`, {
      method: 'POST',
      body: paidDate ? JSON.stringify({ paidDate }) : undefined,
    })
  }

  // Attendance
  async getAttendance(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : ''
    const res = await this.request<{ attendances: any[]; pagination: any }>(`/api/attendance${query}`)
    return {
      data: res?.attendances || [],
      total: res?.pagination?.total || 0,
      page: res?.pagination?.page || 1,
      totalPages: res?.pagination?.totalPages || 1,
    }
  }

  async markAttendance(records: Record<string, any>[]) {
    return this.request<{ attendances: any[]; count: number }>('/api/attendance', {
      method: 'POST',
      body: JSON.stringify(records),
    })
  }

  async bulkMarkAttendance(date: string, records: Record<string, any>[]) {
    return this.request<{ attendances: any[]; count: number; errors?: string[] }>('/api/attendance/bulk-mark', {
      method: 'POST',
      body: JSON.stringify({ date, records }),
    })
  }

  // Leaves
  async getLeaves(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : ''
    const res = await this.request<{ leaves: any[]; pagination: any }>(`/api/leaves${query}`)
    return {
      data: res?.leaves || [],
      total: res?.pagination?.total || 0,
      page: res?.pagination?.page || 1,
      totalPages: res?.pagination?.totalPages || 1,
    }
  }

  async createLeave(data: Record<string, any>) {
    return this.request<any>('/api/leaves', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateLeave(id: string, data: Record<string, any>) {
    return this.request<any>(`/api/leaves/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async approveLeave(id: string) {
    return this.request<any>(`/api/leaves/${id}/approve`, { method: 'POST' })
  }

  async rejectLeave(id: string, reason: string) {
    return this.request<any>(`/api/leaves/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  }

  async cancelLeave(id: string) {
    return this.request<any>(`/api/leaves/${id}/cancel`, { method: 'POST' })
  }

  // HR Stats
  async getHrStats() {
    return this.request<{
      totalEmployees: number
      presentToday: number
      onLeaveToday: number
      monthSalaryPaidTotal: number
      pendingLeaves: number
    }>('/api/dashboard/hr-stats')
  }
}

export const api = new ApiClient()
// trigger
