const API_BASE = ''

interface RequestOptions {
  method?: string
  body?: any
  headers?: Record<string, string>
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }))
      // Include details if available for debugging
      const msg = error.details ? `${error.error}: ${error.details}` : (error.error || `HTTP ${res.status}`)
      throw new Error(msg)
    }

    return res.json()
  }

  // Auth
  login(email: string, password: string) { return this.request('/api/auth/login', { method: 'POST', body: { email, password } }) }
  logout() { return this.request('/api/auth/logout', { method: 'POST' }) }
  getMe() { return this.request('/api/auth/me') }
  changePassword(data: { currentPassword: string; newPassword: string }) { return this.request('/api/auth/change-password', { method: 'POST', body: data }) }

  // Dashboard (single consolidated endpoint)
  getDashboard(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return this.request(`/api/dashboard${qs}`)
  }

  // Expenses
  getExpenses(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return this.request(`/api/expenses${qs}`)
  }
  getExpense(id: string) { return this.request(`/api/expenses/${id}`) }
  createExpense(data: any) { return this.request('/api/expenses', { method: 'POST', body: data }) }
  updateExpense(id: string, data: any) { return this.request(`/api/expenses/${id}`, { method: 'PUT', body: data }) }
  deleteExpense(id: string) { return this.request(`/api/expenses/${id}`, { method: 'DELETE' }) }
  approveAccountantExpense(id: string) { return this.request(`/api/expenses/${id}/approve-accountant`, { method: 'POST' }) }
  approveAdminExpense(id: string) { return this.request(`/api/expenses/${id}/approve-admin`, { method: 'POST' }) }
  rejectExpense(id: string, reason: string) { return this.request(`/api/expenses/${id}/reject`, { method: 'POST', body: { reason } }) }
  returnExpense(id: string, reason: string) { return this.request(`/api/expenses/${id}/return`, { method: 'POST', body: { reason } }) }
  resubmitExpense(id: string, data: any) { return this.request(`/api/expenses/${id}/resubmit`, { method: 'POST', body: data }) }
  markPaidExpense(id: string) { return this.request(`/api/expenses/${id}/mark-paid`, { method: 'POST' }) }
  bulkActionExpense(ids: string[], action: string, reason?: string) { return this.request('/api/expenses/bulk-action', { method: 'POST', body: { ids, action, reason } }) }

  // Advances
  getAdvances(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return this.request(`/api/advances${qs}`)
  }
  createAdvance(data: any) { return this.request('/api/advances', { method: 'POST', body: data }) }
  updateAdvance(id: string, data: any) { return this.request(`/api/advances/${id}`, { method: 'PUT', body: data }) }
  deleteAdvance(id: string) { return this.request(`/api/advances/${id}`, { method: 'DELETE' }) }
  approveAccountantAdvance(id: string) { return this.request(`/api/advances/${id}/approve-accountant`, { method: 'POST' }) }
  approveAdminAdvance(id: string) { return this.request(`/api/advances/${id}/approve-admin`, { method: 'POST' }) }
  rejectAdvance(id: string, reason: string) { return this.request(`/api/advances/${id}/reject`, { method: 'POST', body: { reason } }) }
  returnAdvance(id: string, reason: string) { return this.request(`/api/advances/${id}/return`, { method: 'POST', body: { reason } }) }
  markPaidAdvance(id: string) { return this.request(`/api/advances/${id}/mark-paid`, { method: 'POST' }) }

  // Requisitions
  getRequisitions(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return this.request(`/api/requisitions${qs}`)
  }
  getRequisition(id: string) { return this.request(`/api/requisitions/${id}`) }
  createRequisition(data: any) { return this.request('/api/requisitions', { method: 'POST', body: data }) }
  updateRequisition(id: string, data: any) { return this.request(`/api/requisitions/${id}`, { method: 'PUT', body: data }) }
  deleteRequisition(id: string) { return this.request(`/api/requisitions/${id}`, { method: 'DELETE' }) }
  approveStockManagerMir(id: string) { return this.request(`/api/requisitions/${id}/approve-stock-manager`, { method: 'POST' }) }
  approveAdminMir(id: string) { return this.request(`/api/requisitions/${id}/approve-admin`, { method: 'POST' }) }
  rejectMir(id: string, reason: string) { return this.request(`/api/requisitions/${id}/reject`, { method: 'POST', body: { reason } }) }
  returnMir(id: string, reason: string) { return this.request(`/api/requisitions/${id}/return`, { method: 'POST', body: { reason } }) }
  resubmitMir(id: string, data: any) { return this.request(`/api/requisitions/${id}/resubmit`, { method: 'POST', body: data }) }
  orderMir(id: string) { return this.request(`/api/requisitions/${id}/order`, { method: 'POST' }) }
  receiveMir(id: string) { return this.request(`/api/requisitions/${id}/receive`, { method: 'POST' }) }
  bulkActionRequisition(ids: string[], action: string, reason?: string) { return this.request('/api/requisitions/bulk-action', { method: 'POST', body: { ids, action, reason } }) }

  // BOQ Items
  getBOQItems(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return this.request(`/api/boq${qs}`)
  }

  // Clients
  getClients(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return this.request(`/api/clients${qs}`)
  }
  getClient(id: string) { return this.request(`/api/clients/${id}`) }
  createClient(data: any) { return this.request('/api/clients', { method: 'POST', body: data }) }
  updateClient(id: string, data: any) { return this.request(`/api/clients/${id}`, { method: 'PUT', body: data }) }
  deleteClient(id: string) { return this.request(`/api/clients/${id}`, { method: 'DELETE' }) }

  // Sites
  getSites(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return this.request(`/api/sites${qs}`)
  }
  getSite(id: string) { return this.request(`/api/sites/${id}`) }
  createSite(data: any) { return this.request('/api/sites', { method: 'POST', body: data }) }
  updateSite(id: string, data: any) { return this.request(`/api/sites/${id}`, { method: 'PUT', body: data }) }
  deleteSite(id: string) { return this.request(`/api/sites/${id}`, { method: 'DELETE' }) }

  // Categories
  getCategories(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return this.request(`/api/categories${qs}`)
  }
  getCategory(id: string) { return this.request(`/api/categories/${id}`) }
  createCategory(data: any) { return this.request('/api/categories', { method: 'POST', body: data }) }
  updateCategory(id: string, data: any) { return this.request(`/api/categories/${id}`, { method: 'PUT', body: data }) }
  deleteCategory(id: string) { return this.request(`/api/categories/${id}`, { method: 'DELETE' }) }

  // Users
  getUsers() { return this.request('/api/users') }
  getUser(id: string) { return this.request(`/api/users/${id}`) }
  createUser(data: any) { return this.request('/api/users', { method: 'POST', body: data }) }
  updateUser(id: string, data: any) { return this.request(`/api/users/${id}`, { method: 'PUT', body: data }) }
  deleteUser(id: string) { return this.request(`/api/users/${id}`, { method: 'DELETE' }) }

  // Employees
  getEmployees(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return this.request(`/api/employees${qs}`)
  }
  getEmployee(id: string) { return this.request(`/api/employees/${id}`) }
  createEmployee(data: any) { return this.request('/api/employees', { method: 'POST', body: data }) }
  updateEmployee(id: string, data: any) { return this.request(`/api/employees/${id}`, { method: 'PUT', body: data }) }
  deleteEmployee(id: string) { return this.request(`/api/employees/${id}`, { method: 'DELETE' }) }

  // Leaves
  getLeaves(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return this.request(`/api/leaves${qs}`)
  }
  getLeave(id: string) { return this.request(`/api/leaves/${id}`) }
  createLeave(data: any) { return this.request('/api/leaves', { method: 'POST', body: data }) }
  approveLeave(id: string) { return this.request(`/api/leaves/${id}/approve`, { method: 'POST' }) }
  rejectLeave(id: string, reason: string) { return this.request(`/api/leaves/${id}/reject`, { method: 'POST', body: { reason } }) }
  cancelLeave(id: string) { return this.request(`/api/leaves/${id}/cancel`, { method: 'POST' }) }

  // Comments
  getComments(entityType: string, entityId: string) {
    return this.request(`/api/comments?entityType=${entityType}&entityId=${entityId}`)
  }
  addComment(data: { entityType: string; entityId: string; content: string }) {
    return this.request('/api/comments', { method: 'POST', body: data })
  }

  // Reports
  getReports(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return this.request(`/api/reports${qs}`)
  }

  // Audit Logs
  getAuditLogs(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return this.request(`/api/audit-logs${qs}`)
  }

  // Bulk Upload
  bulkUpload(data: FormData) {
    return fetch(`${this.baseUrl}/api/bulk-upload`, {
      method: 'POST',
      body: data,
    }).then(async res => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      return res.json()
    })
  }

  // Bulk Upload Templates
  getBulkUploadTemplate(type: string) {
    return fetch(`${this.baseUrl}/api/expenses/bulk-upload/template?type=${type}`).then(r => r.blob())
  }
  getAdvanceBulkUploadTemplate() {
    return fetch(`${this.baseUrl}/api/advances/bulk-upload/template`).then(r => r.blob())
  }

  // Reset Data
  resetData() { return this.request('/api/reset-data', { method: 'POST' }) }
}

export const api = new ApiClient(API_BASE)
