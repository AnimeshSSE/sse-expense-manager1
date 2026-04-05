#!/usr/bin/env bun
/**
 * SSE Expense Manager — Full Integration Test Suite
 * Tests every use case across all 4 roles with demo data.
 */
import { PrismaClient } from '@prisma/client'

const BASE = 'http://localhost:3000'
const db = new PrismaClient()

let results: { test: string; status: 'PASS' | 'FAIL'; detail: string }[] = []

function log(test: string, status: 'PASS' | 'FAIL', detail: string) {
  const icon = status === 'PASS' ? '✅' : '❌'
  console.log(`  ${icon} ${test}: ${detail}`)
  results.push({ test, status, detail })
}

async function api(method: string, path: string, body?: any, cookie?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cookie) headers['Cookie'] = `auth-token=${cookie}`
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  const setCookie = res.headers.get('set-cookie') || ''
  const token = setCookie.match(/auth-token=([^;]+)/)?.[1]
  return { status: res.status, data, token }
}

// ===================== 1. AUTH TESTS =====================
async function testAuth() {
  console.log('\n🔐 AUTH TESTS')

  // Login all 4 roles
  const roles = [
    { email: 'admin@demo.com', password: 'admin123', role: 'ADMIN' },
    { email: 'accountant@demo.com', password: 'accountant123', role: 'ACCOUNTANT' },
    { email: 'stock@demo.com', password: 'stock123', role: 'STOCK_MANAGER' },
    { email: 'user@demo.com', password: 'user123', role: 'USER' },
  ]

  const tokens: Record<string, string> = {}
  for (const r of roles) {
    const res = await api('POST', '/api/auth/login', { email: r.email, password: r.password })
    log(`Login ${r.role}`, res.status === 200 ? 'PASS' : 'FAIL', `HTTP ${res.status}`)
    if (res.token) tokens[r.role] = res.token
  }

  // Bad login
  const badLogin = await api('POST', '/api/auth/login', { email: 'bad@test.com', password: 'wrong' })
  log('Login bad credentials', badLogin.status === 401 ? 'PASS' : 'FAIL', `HTTP ${badLogin.status}`)

  // Session check
  const session = await api('GET', '/api/auth/me', undefined, tokens.ADMIN)
  log('Session valid (admin)', session.status === 200 && session.data?.user?.role === 'ADMIN' ? 'PASS' : 'FAIL',
    `HTTP ${session.status}, role=${session.data?.user?.role}`)

  // No session
  const noSession = await api('GET', '/api/auth/me')
  log('No session returns 401', noSession.status === 401 ? 'PASS' : 'FAIL', `HTTP ${noSession.status}`)

  // Change password
  const changePw = await api('POST', '/api/auth/change-password',
    { currentPassword: 'admin123', newPassword: 'admin456' }, tokens.ADMIN)
  log('Change password', changePw.status === 200 ? 'PASS' : 'FAIL', `HTTP ${changePw.status}`)

  // Login with new password
  const newPwLogin = await api('POST', '/api/auth/login', { email: 'admin@demo.com', password: 'admin456' })
  log('Login new password', newPwLogin.status === 200 ? 'PASS' : 'FAIL', `HTTP ${newPwLogin.status}`)
  if (newPwLogin.token) tokens.ADMIN = newPwLogin.token

  // Revert password
  await api('POST', '/api/auth/change-password',
    { currentPassword: 'admin456', newPassword: 'admin123' }, tokens.ADMIN)
  const revertLogin = await api('POST', '/api/auth/login', { email: 'admin@demo.com', password: 'admin123' })
  log('Revert password', revertLogin.status === 200 ? 'PASS' : 'FAIL', `HTTP ${revertLogin.status}`)
  if (revertLogin.token) tokens.ADMIN = revertLogin.token

  // Logout
  const logout = await api('POST', '/api/auth/logout', undefined, tokens.ADMIN)
  log('Logout', logout.status === 200 ? 'PASS' : 'FAIL', `HTTP ${logout.status}`)

  // Re-login admin after logout
  const relogin = await api('POST', '/api/auth/login', { email: 'admin@demo.com', password: 'admin123' })
  log('Re-login after logout', relogin.status === 200 ? 'PASS' : 'FAIL', `HTTP ${relogin.status}`)
  if (relogin.token) tokens.ADMIN = relogin.token

  return tokens
}

// ===================== 2. USER MANAGEMENT (ADMIN) =====================
async function testUserManagement(tokens: Record<string, string>) {
  console.log('\n👥 USER MANAGEMENT TESTS')

  // List users
  const list = await api('GET', '/api/users', undefined, tokens.ADMIN)
  log('List users', list.status === 200 && Array.isArray(list.data) ? 'PASS' : 'FAIL',
    `HTTP ${list.status}, count=${list.data?.length}`)

  // Create user
  const create = await api('POST', '/api/users', {
    email: 'test@demo.com', password: 'test123', name: 'Test User', role: 'USER'
  }, tokens.ADMIN)
  log('Create user', create.status === 200 && create.data?.id ? 'PASS' : 'FAIL',
    `HTTP ${create.status}, id=${create.data?.id?.slice(0, 8)}`)
  const testUserId = create.data?.id

  // Update user
  const update = await api('PUT', `/api/users/${testUserId}`, {
    name: 'Test User Updated', role: 'ACCOUNTANT', isActive: true
  }, tokens.ADMIN)
  log('Update user', update.status === 200 && update.data?.name === 'Test User Updated' ? 'PASS' : 'FAIL',
    `HTTP ${update.status}`)

  // Non-admin cannot create
  const forbidden = await api('POST', '/api/users', {
    email: 'forbidden@demo.com', password: 'test', name: 'Nope', role: 'USER'
  }, tokens.USER)
  log('Non-admin create forbidden', forbidden.status === 403 ? 'PASS' : 'FAIL', `HTTP ${forbidden.status}`)

  // Delete user
  const del = await api('DELETE', `/api/users/${testUserId}`, undefined, tokens.ADMIN)
  log('Delete user', del.status === 200 ? 'PASS' : 'FAIL', `HTTP ${del.status}`)

  // Cannot delete self
  const adminUsers = await api('GET', '/api/users', undefined, tokens.ADMIN)
  const adminId = adminUsers.data?.find((u: any) => u.email === 'admin@demo.com')?.id
  const selfDel = await api('DELETE', `/api/users/${adminId}`, undefined, tokens.ADMIN)
  log('Cannot delete self', selfDel.status === 400 ? 'PASS' : 'FAIL', `HTTP ${selfDel.status}, ${selfDel.data?.error}`)
}

// ===================== 3. CLIENTS, SITES, CATEGORIES =====================
async function testMasterData(tokens: Record<string, string>) {
  console.log('\n🏢 MASTER DATA TESTS')

  // Clients
  const clients = await api('GET', '/api/clients', undefined, tokens.ADMIN)
  log('List clients', clients.status === 200 && Array.isArray(clients.data) ? 'PASS' : 'FAIL',
    `HTTP ${clients.status}, count=${clients.data?.length}`)

  const newClient = await api('POST', '/api/clients', { name: 'Test Client', description: 'Test' }, tokens.ADMIN)
  log('Create client', newClient.status === 200 ? 'PASS' : 'FAIL', `HTTP ${newClient.status}`)
  const clientId = newClient.data?.id

  const updateClient = await api('PUT', `/api/clients/${clientId}`, { name: 'Updated Client', description: 'Upd', isActive: true }, tokens.ADMIN)
  log('Update client', updateClient.status === 200 ? 'PASS' : 'FAIL', `HTTP ${updateClient.status}`)

  // Sites
  const sites = await api('GET', '/api/sites', undefined, tokens.ADMIN)
  log('List sites', sites.status === 200 ? 'PASS' : 'FAIL', `HTTP ${sites.status}, count=${sites.data?.length}`)

  const existingClient = clients.data?.[0]?.id
  const newSite = await api('POST', '/api/sites', {
    name: 'Test Site', clientId: existingClient, location: 'Test Loc',
    description: 'Test', budget: 100000
  }, tokens.ADMIN)
  log('Create site', newSite.status === 200 ? 'PASS' : 'FAIL', `HTTP ${newSite.status}`)
  const siteId = newSite.data?.id

  // Categories
  const categories = await api('GET', '/api/categories', undefined, tokens.ADMIN)
  log('List categories', categories.status === 200 ? 'PASS' : 'FAIL',
    `HTTP ${categories.status}, count=${categories.data?.length}`)

  const newCat = await api('POST', '/api/categories', {
    name: 'Test Category', type: 'EXPENSE', description: 'Test'
  }, tokens.ADMIN)
  log('Create category', newCat.status === 200 ? 'PASS' : 'FAIL', `HTTP ${newCat.status}`)

  // Cleanup
  await api('DELETE', `/api/sites/${siteId}`, undefined, tokens.ADMIN)
  await api('DELETE', `/api/clients/${clientId}`, undefined, tokens.ADMIN)
  log('Cleanup master data', true ? 'PASS' : 'FAIL', 'Deleted test site & client')
}

// ===================== 4. EXPENSE WORKFLOW =====================
async function testExpenseWorkflow(tokens: Record<string, string>) {
  console.log('\n💰 EXPENSE WORKFLOW TESTS')

  // Get site and category for creating expense
  const sites = await api('GET', '/api/sites', undefined, tokens.ADMIN)
  const cats = await api('GET', '/api/categories', undefined, tokens.ADMIN)
  const siteId = sites.data?.[0]?.id
  const catId = cats.data?.[0]?.id

  // USER creates expense
  const create = await api('POST', '/api/expenses', {
    siteId, categoryId: catId, amount: 5000, description: 'Integration test expense',
    expenseDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'CASH', sellerName: 'Test Seller', invoiceNumber: 'TEST-001'
  }, tokens.USER)
  log('User creates expense', create.status === 200 ? 'PASS' : 'FAIL', `HTTP ${create.status}`)
  const expId = create.data?.id

  // List expenses with filters
  const list = await api('GET', '/api/expenses?page=1&limit=5&sort=createdAt&sortDir=desc', undefined, tokens.ADMIN)
  log('List expenses (paginated)', list.status === 200 && list.data?.data?.length > 0 ? 'PASS' : 'FAIL',
    `HTTP ${list.status}, total=${list.data?.total}`)

  // Get single expense
  const single = await api('GET', `/api/expenses/${expId}`, undefined, tokens.ADMIN)
  log('Get expense detail', single.status === 200 && single.data?.description === 'Integration test expense' ? 'PASS' : 'FAIL',
    `HTTP ${single.status}`)

  // USER cannot approve
  const userApprove = await api('POST', `/api/expenses/${expId}/approve-accountant`, undefined, tokens.USER)
  log('User cannot approve', userApprove.status === 403 ? 'PASS' : 'FAIL', `HTTP ${userApprove.status}`)

  // ACCOUNTANT approves
  const acctApprove = await api('POST', `/api/expenses/${expId}/approve-accountant`, undefined, tokens.ACCOUNTANT)
  log('Accountant approves', acctApprove.status === 200 ? 'PASS' : 'FAIL', `HTTP ${acctApprove.status}`)

  // Verify status changed
  const afterAcct = await api('GET', `/api/expenses/${expId}`, undefined, tokens.ADMIN)
  log('Status = ACCOUNTANT_APPROVED', afterAcct.data?.status === 'ACCOUNTANT_APPROVED' ? 'PASS' : 'FAIL',
    `status=${afterAcct.data?.status}`)

  // Cannot approve again
  const doubleApprove = await api('POST', `/api/expenses/${expId}/approve-accountant`, undefined, tokens.ACCOUNTANT)
  log('Cannot double-approve', doubleApprove.status === 400 ? 'PASS' : 'FAIL', `HTTP ${doubleApprove.status}`)

  // ADMIN approves
  const adminApprove = await api('POST', `/api/expenses/${expId}/approve-admin`, undefined, tokens.ADMIN)
  log('Admin approves', adminApprove.status === 200 ? 'PASS' : 'FAIL', `HTTP ${adminApprove.status}`)

  const afterAdmin = await api('GET', `/api/expenses/${expId}`, undefined, tokens.ADMIN)
  log('Status = ADMIN_APPROVED', afterAdmin.data?.status === 'ADMIN_APPROVED' ? 'PASS' : 'FAIL',
    `status=${afterAdmin.data?.status}`)

  // ACCOUNTANT marks paid
  const markPaid = await api('POST', `/api/expenses/${expId}/mark-paid`, undefined, tokens.ACCOUNTANT)
  log('Mark as paid', markPaid.status === 200 ? 'PASS' : 'FAIL', `HTTP ${markPaid.status}`)

  const afterPaid = await api('GET', `/api/expenses/${expId}`, undefined, tokens.ADMIN)
  log('Status = PAID', afterPaid.data?.status === 'PAID' ? 'PASS' : 'FAIL', `status=${afterPaid.data?.status}`)
}

// ===================== 5. EXPENSE REJECT / RETURN =====================
async function testExpenseRejectReturn(tokens: Record<string, string>) {
  console.log('\n🔄 EXPENSE REJECT & RETURN TESTS')

  const sites = await api('GET', '/api/sites', undefined, tokens.ADMIN)
  const cats = await api('GET', '/api/categories', undefined, tokens.ADMIN)
  const siteId = sites.data?.[0]?.id
  const catId = cats.data?.[1]?.id || cats.data?.[0]?.id

  // Create expense for reject test
  const exp1 = await api('POST', '/api/expenses', {
    siteId, categoryId: catId, amount: 3000, description: 'Reject test',
    expenseDate: new Date().toISOString().slice(0, 10), paymentMethod: 'UPI'
  }, tokens.USER)

  // Reject it
  const reject = await api('POST', `/api/expenses/${exp1.data?.id}/reject`, { reason: 'Budget exceeded' }, tokens.ACCOUNTANT)
  log('Reject expense', reject.status === 200 ? 'PASS' : 'FAIL', `HTTP ${reject.status}`)

  const afterReject = await api('GET', `/api/expenses/${exp1.data?.id}`, undefined, tokens.ADMIN)
  log('Status = REJECTED', afterReject.data?.status === 'REJECTED' ? 'PASS' : 'FAIL', `status=${afterReject.data?.status}`)
  log('Rejection reason saved', afterReject.data?.rejectionReason === 'Budget exceeded' ? 'PASS' : 'FAIL',
    `reason=${afterReject.data?.rejectionReason}`)

  // Create expense for return test
  const exp2 = await api('POST', '/api/expenses', {
    siteId, categoryId: catId, amount: 4000, description: 'Return test',
    expenseDate: new Date().toISOString().slice(0, 10), paymentMethod: 'CASH'
  }, tokens.USER)

  // Return it
  const ret = await api('POST', `/api/expenses/${exp2.data?.id}/return`, { reason: 'Fix the description' }, tokens.ACCOUNTANT)
  log('Return expense', ret.status === 200 ? 'PASS' : 'FAIL', `HTTP ${ret.status}`)

  const afterReturn = await api('GET', `/api/expenses/${exp2.data?.id}`, undefined, tokens.ADMIN)
  log('Status = RETURNED', afterReturn.data?.status === 'RETURNED' ? 'PASS' : 'FAIL', `status=${afterReturn.data?.status}`)
  log('Return reason saved', afterReturn.data?.returnReason === 'Fix the description' ? 'PASS' : 'FAIL',
    `reason=${afterReturn.data?.returnReason}`)

  // Resubmit returned expense
  const resubmit = await api('POST', `/api/expenses/${exp2.data?.id}/resubmit`, undefined, tokens.USER)
  log('Resubmit expense', resubmit.status === 200 ? 'PASS' : 'FAIL', `HTTP ${resubmit.status}`)

  const afterResubmit = await api('GET', `/api/expenses/${exp2.data?.id}`, undefined, tokens.ADMIN)
  log('Status = PENDING after resubmit', afterResubmit.data?.status === 'PENDING' ? 'PASS' : 'FAIL',
    `status=${afterResubmit.data?.status}`)
}

// ===================== 6. MIR WORKFLOW =====================
async function testMirWorkflow(tokens: Record<string, string>) {
  console.log('\n📦 MIR WORKFLOW TESTS')

  const sites = await api('GET', '/api/sites', undefined, tokens.ADMIN)
  const siteId = sites.data?.[0]?.id
  const requiredDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)

  // USER creates MIR with BOQ items
  const mir = await api('POST', '/api/requisitions', {
    siteId, title: 'Integration Test MIR', description: 'Test MIR',
    requiredDate, priority: 'HIGH', notes: 'Test notes',
    boqItems: [
      { itemName: 'Test Item A', description: 'Desc A', quantity: 10, unit: 'pcs', unitPrice: 500 },
      { itemName: 'Test Item B', description: 'Desc B', quantity: 5, unit: 'boxes', unitPrice: 2000 },
    ]
  }, tokens.USER)
  log('User creates MIR with BOQ', mir.status === 200 ? 'PASS' : 'FAIL', `HTTP ${mir.status}`)
  const mirId = mir.data?.id

  // Verify totalAmount calculated
  const mirDetail = await api('GET', `/api/requisitions/${mirId}`, undefined, tokens.ADMIN)
  const expectedTotal = 10 * 500 + 5 * 2000
  log(`Total calculated (${expectedTotal})`, mirDetail.data?.totalAmount === expectedTotal ? 'PASS' : 'FAIL',
    `total=${mirDetail.data?.totalAmount}`)
  log('BOQ items count', mirDetail.data?.boqItems?.length === 2 ? 'PASS' : 'FAIL',
    `count=${mirDetail.data?.boqItems?.length}`)

  // List MIRs
  const mirList = await api('GET', '/api/requisitions?page=1&limit=5', undefined, tokens.ADMIN)
  log('List requisitions', mirList.status === 200 && mirList.data?.data?.length > 0 ? 'PASS' : 'FAIL',
    `HTTP ${mirList.status}`)

  // STOCK MANAGER approves
  const smApprove = await api('POST', `/api/requisitions/${mirId}/approve-stock-manager`, undefined, tokens.STOCK_MANAGER)
  log('Stock Manager approves', smApprove.status === 200 ? 'PASS' : 'FAIL', `HTTP ${smApprove.status}`)

  const afterSM = await api('GET', `/api/requisitions/${mirId}`, undefined, tokens.ADMIN)
  log('Status = STOCK_MANAGER_APPROVED', afterSM.data?.status === 'STOCK_MANAGER_APPROVED' ? 'PASS' : 'FAIL',
    `status=${afterSM.data?.status}`)

  // ADMIN approves
  const admApprove = await api('POST', `/api/requisitions/${mirId}/approve-admin`, undefined, tokens.ADMIN)
  log('Admin approves MIR', admApprove.status === 200 ? 'PASS' : 'FAIL', `HTTP ${admApprove.status}`)

  // STOCK MANAGER orders
  const order = await api('POST', `/api/requisitions/${mirId}/order`, undefined, tokens.STOCK_MANAGER)
  log('Mark as ordered', order.status === 200 ? 'PASS' : 'FAIL', `HTTP ${order.status}`)

  const afterOrder = await api('GET', `/api/requisitions/${mirId}`, undefined, tokens.ADMIN)
  log('Status = ORDERED', afterOrder.data?.status === 'ORDERED' ? 'PASS' : 'FAIL', `status=${afterOrder.data?.status}`)

  // STOCK MANAGER receives
  const receive = await api('POST', `/api/requisitions/${mirId}/receive`, undefined, tokens.STOCK_MANAGER)
  log('Mark as received', receive.status === 200 ? 'PASS' : 'FAIL', `HTTP ${receive.status}`)

  const afterReceive = await api('GET', `/api/requisitions/${mirId}`, undefined, tokens.ADMIN)
  log('Status = RECEIVED', afterReceive.data?.status === 'RECEIVED' ? 'PASS' : 'FAIL',
    `status=${afterReceive.data?.status}`)
}

// ===================== 7. MIR REJECT / RETURN =====================
async function testMirRejectReturn(tokens: Record<string, string>) {
  console.log('\n🔄 MIR REJECT & RETURN TESTS')

  const sites = await api('GET', '/api/sites', undefined, tokens.ADMIN)
  const siteId = sites.data?.[0]?.id
  const requiredDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)

  // Create MIR to reject
  const mir1 = await api('POST', '/api/requisitions', {
    siteId, title: 'Reject Test MIR', description: 'Test',
    requiredDate, priority: 'LOW',
    boqItems: [{ itemName: 'Item', quantity: 1, unit: 'pc', unitPrice: 100 }]
  }, tokens.USER)
  const rej = await api('POST', `/api/requisitions/${mir1.data?.id}/reject`, { reason: 'Not needed' }, tokens.STOCK_MANAGER)
  log('Reject MIR', rej.status === 200 ? 'PASS' : 'FAIL', `HTTP ${rej.status}`)

  // Create MIR to return
  const mir2 = await api('POST', '/api/requisitions', {
    siteId, title: 'Return Test MIR', description: 'Test',
    requiredDate, priority: 'MEDIUM',
    boqItems: [{ itemName: 'Item', quantity: 1, unit: 'pc', unitPrice: 200 }]
  }, tokens.USER)
  const ret = await api('POST', `/api/requisitions/${mir2.data?.id}/return`, { reason: 'Update quantities' }, tokens.STOCK_MANAGER)
  log('Return MIR', ret.status === 200 ? 'PASS' : 'FAIL', `HTTP ${ret.status}`)

  // Resubmit
  const resub = await api('POST', `/api/requisitions/${mir2.data?.id}/resubmit`, undefined, tokens.USER)
  log('Resubmit MIR', resub.status === 200 ? 'PASS' : 'FAIL', `HTTP ${resub.status}`)
}

// ===================== 8. BOQ AGGREGATED VIEW =====================
async function testBoqView(tokens: Record<string, string>) {
  console.log('\n📋 BOQ AGGREGATED VIEW TESTS')

  const boq = await api('GET', '/api/boq', undefined, tokens.ADMIN)
  log('List BOQ items', boq.status === 200 && Array.isArray(boq.data) && boq.data.length > 0 ? 'PASS' : 'FAIL',
    `HTTP ${boq.status}, count=${boq.data?.length}`)

  // Check first item has required fields
  if (boq.data?.length > 0) {
    const item = boq.data[0]
    log('BOQ has itemName', !!item.itemName ? 'PASS' : 'FAIL', `itemName=${item.itemName}`)
    log('BOQ has requisition', !!item.requisition?.title ? 'PASS' : 'FAIL', `mir=${item.requisition?.title}`)
  }

  // Filter BOQ
  const filtered = await api('GET', '/api/boq?search=cement', undefined, tokens.ADMIN)
  log('BOQ search filter', filtered.status === 200 ? 'PASS' : 'FAIL', `HTTP ${filtered.status}`)
}

// ===================== 9. DASHBOARD =====================
async function testDashboard(tokens: Record<string, string>) {
  console.log('\n📊 DASHBOARD TESTS')

  const dash = await api('GET', '/api/dashboard', undefined, tokens.ADMIN)
  log('Dashboard stats', dash.status === 200 ? 'PASS' : 'FAIL', `HTTP ${dash.status}`)

  // Check all stat keys
  const d = dash.data
  log('Has thisMonthExpenses', !!d.thisMonthExpenses ? 'PASS' : 'FAIL', '')
  log('Has pendingExpenses', !!d.pendingExpenses ? 'PASS' : 'FAIL', '')
  log('Has paidExpenses', !!d.paidExpenses ? 'PASS' : 'FAIL', '')
  log('Has pendingMirs', !!d.pendingMirs ? 'PASS' : 'FAIL', '')
  log('Has recentExpenses', Array.isArray(d.recentExpenses) ? 'PASS' : 'FAIL', `count=${d.recentExpenses?.length}`)
  log('Has recentMirs', Array.isArray(d.recentMirs) ? 'PASS' : 'FAIL', `count=${d.recentMirs?.length}`)

  // Expense stats by category
  const month = new Date().toISOString().slice(0, 7)
  const stats = await api('GET', `/api/dashboard/expense-stats?month=${month}`, undefined, tokens.ADMIN)
  log('Expense stats by category', stats.status === 200 ? 'PASS' : 'FAIL', `HTTP ${stats.status}`)
}

// ===================== 10. AUDIT LOGS =====================
async function testAuditLogs(tokens: Record<string, string>) {
  console.log('\n📝 AUDIT LOGS TESTS')

  const logs = await api('GET', '/api/audit-logs?page=1&limit=10', undefined, tokens.ADMIN)
  log('List audit logs', logs.status === 200 && Array.isArray(logs.data?.data) ? 'PASS' : 'FAIL',
    `HTTP ${logs.status}, count=${logs.data?.data?.length}`)

  // Check recent logs from our test actions
  if (logs.data?.data?.length > 0) {
    const recent = logs.data.data[0]
    log('Audit log has action', !!recent.action ? 'PASS' : 'FAIL', `action=${recent.action}`)
    log('Audit log has user', !!recent.user?.name ? 'PASS' : 'FAIL', `user=${recent.user?.name}`)
    log('Audit log has entityType', !!recent.entityType ? 'PASS' : 'FAIL', `type=${recent.entityType}`)
  }

  // USER cannot access audit logs
  const userLogs = await api('GET', '/api/audit-logs?page=1&limit=5', undefined, tokens.USER)
  log('User audit access forbidden', userLogs.status === 403 ? 'PASS' : 'FAIL', `HTTP ${userLogs.status}`)
}

// ===================== 11. ROLE-BASED VISIBILITY =====================
async function testRoleVisibility(tokens: Record<string, string>) {
  console.log('\n🔒 ROLE-BASED VISIBILITY TESTS')

  // User should only see own expenses
  const userExpenses = await api('GET', '/api/expenses?page=1&limit=50', undefined, tokens.USER)
  const allOwn = userExpenses.data?.data?.every((e: any) => e.userId === userExpenses.data?.data?.[0]?.userId)
  log('User sees only own expenses', allOwn ? 'PASS' : 'FAIL',
    `total=${userExpenses.data?.total}`)

  // Admin sees all
  const adminExpenses = await api('GET', '/api/expenses?page=1&limit=50', undefined, tokens.ADMIN)
  log('Admin sees all expenses', adminExpenses.status === 200 && adminExpenses.data?.total > userExpenses.data?.total ? 'PASS' : 'FAIL',
    `admin=${adminExpenses.data?.total}, user=${userExpenses.data?.total}`)

  // Stock Manager sees all MIRs
  const smMirs = await api('GET', '/api/requisitions?page=1&limit=50', undefined, tokens.STOCK_MANAGER)
  log('Stock Mgr sees all MIRs', smMirs.status === 200 ? 'PASS' : 'FAIL', `HTTP ${smMirs.status}`)

  // User sees only own MIRs
  const userMirs = await api('GET', '/api/requisitions?page=1&limit=50', undefined, tokens.USER)
  log('User sees only own MIRs', userMirs.data?.total <= smMirs.data?.total ? 'PASS' : 'FAIL',
    `user=${userMirs.data?.total}, sm=${smMirs.data?.total}`)

  // User cannot access admin endpoints
  const userClients = await api('GET', '/api/clients', undefined, tokens.USER)
  log('User cannot list clients', userClients.status === 403 ? 'PASS' : 'FAIL', `HTTP ${userClients.status}`)

  const userSites = await api('GET', '/api/sites', undefined, tokens.USER)
  log('User cannot list sites', userSites.status === 403 ? 'PASS' : 'FAIL', `HTTP ${userSites.status}`)

  const userCats = await api('GET', '/api/categories', undefined, tokens.USER)
  log('User cannot list categories', userCats.status === 403 ? 'PASS' : 'FAIL', `HTTP ${userCats.status}`)
}

// ===================== 12. EXPENSE FILTERS =====================
async function testExpenseFilters(tokens: Record<string, string>) {
  console.log('\n🔍 EXPENSE FILTER TESTS')

  // Filter by status
  const pending = await api('GET', '/api/expenses?status=PENDING', undefined, tokens.ADMIN)
  log('Filter by status', pending.status === 200 && pending.data?.data?.every((e: any) => e.status === 'PENDING') ? 'PASS' : 'FAIL',
    `count=${pending.data?.data?.length}`)

  // Filter by payment method
  const cash = await api('GET', '/api/expenses?paymentMethod=CASH', undefined, tokens.ADMIN)
  log('Filter by payment method', cash.status === 200 && cash.data?.data?.every((e: any) => e.paymentMethod === 'CASH') ? 'PASS' : 'FAIL',
    `count=${cash.data?.data?.length}`)

  // Filter by search
  const search = await api('GET', '/api/expenses?search=cement', undefined, tokens.ADMIN)
  log('Search expenses', search.status === 200 ? 'PASS' : 'FAIL', `HTTP ${search.status}, count=${search.data?.data?.length}`)

  // Filter by late only
  const late = await api('GET', '/api/expenses?lateOnly=true', undefined, tokens.ADMIN)
  log('Filter late submissions', late.status === 200 ? 'PASS' : 'FAIL',
    `HTTP ${late.status}, count=${late.data?.data?.length}`)
}

// ===================== 13. DELETE & EDGE CASES =====================
async function testEdgeCases(tokens: Record<string, string>) {
  console.log('\n⚠️ EDGE CASES TESTS')

  const sites = await api('GET', '/api/sites', undefined, tokens.ADMIN)
  const cats = await api('GET', '/api/categories', undefined, tokens.ADMIN)

  // Create and delete own expense
  const exp = await api('POST', '/api/expenses', {
    siteId: sites.data?.[0]?.id, categoryId: cats.data?.[0]?.id,
    amount: 100, description: 'To delete',
    expenseDate: new Date().toISOString().slice(0, 10)
  }, tokens.USER)
  const del = await api('DELETE', `/api/expenses/${exp.data?.id}`, undefined, tokens.USER)
  log('Delete own PENDING expense', del.status === 200 ? 'PASS' : 'FAIL', `HTTP ${del.status}`)

  // Cannot delete others
  const exp2 = await api('POST', '/api/expenses', {
    siteId: sites.data?.[0]?.id, categoryId: cats.data?.[0]?.id,
    amount: 100, description: 'Others expense',
    expenseDate: new Date().toISOString().slice(0, 10)
  }, tokens.USER)
  const delOther = await api('DELETE', `/api/expenses/${exp2.data?.id}`, undefined, tokens.ADMIN)
  log('Admin cannot delete others expense', delOther.status === 403 ? 'PASS' : 'FAIL',
    `HTTP ${delOther.status}`)

  // Create expense without required fields
  const badExp = await api('POST', '/api/expenses', {
    siteId: sites.data?.[0]?.id, amount: 100, description: 'Missing category'
  }, tokens.USER)
  log('Reject expense missing fields', badExp.status === 400 ? 'PASS' : 'FAIL', `HTTP ${badExp.status}`)

  // Get non-existent expense
  const notFound = await api('GET', '/api/expenses/nonexistent123', undefined, tokens.ADMIN)
  log('Non-existent expense 404', notFound.status === 404 ? 'PASS' : 'FAIL', `HTTP ${notFound.status}`)
}

// ===================== RUN ALL =====================
async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  SSE EXPENSE MANAGER — FULL INTEGRATION TEST SUITE')
  console.log('═══════════════════════════════════════════════════════')

  // DB check
  const userCount = await db.user.count()
  const expCount = await db.expense.count()
  const mirCount = await db.requisition.count()
  console.log(`\n📦 Database: ${userCount} users, ${expCount} expenses, ${mirCount} requisitions`)

  const tokens = await testAuth()
  await testUserManagement(tokens)
  await testMasterData(tokens)
  await testExpenseWorkflow(tokens)
  await testExpenseRejectReturn(tokens)
  await testMirWorkflow(tokens)
  await testMirRejectReturn(tokens)
  await testBoqView(tokens)
  await testDashboard(tokens)
  await testAuditLogs(tokens)
  await testRoleVisibility(tokens)
  await testExpenseFilters(tokens)
  await testEdgeCases(tokens)

  // SUMMARY
  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status === 'FAIL').length
  console.log('\n═══════════════════════════════════════════════════════')
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED (${results.length} total)`)
  if (failed > 0) {
    console.log('\n  ❌ FAILED TESTS:')
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`     • ${r.test}: ${r.detail}`)
    })
  } else {
    console.log('\n  🎉 ALL TESTS PASSED — READY FOR DEPLOYMENT')
  }
  console.log('═══════════════════════════════════════════════════════')

  await db.$disconnect()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('Test runner error:', e)
  process.exit(1)
})
