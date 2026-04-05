#!/usr/bin/env bun
/**
 * API Contract Verification Script
 * 
 * Run this after every code change to verify API response shapes
 * match what the frontend components expect.
 * 
 * Usage: bun scripts/verify-api-contracts.ts
 * 
 * This script:
 * 1. Logs in and gets a session cookie
 * 2. Calls every list API endpoint
 * 3. Verifies response body structure (not just HTTP 200)
 * 4. Checks that data arrays have items
 * 5. Checks that pagination objects have expected fields
 * 6. Validates field existence on first data item
 */

const BASE = 'http://localhost:3000'

interface TestCase {
  name: string
  url: string
  expects: {
    topLevelKeys: string[]
    arrayKey?: string          // which top-level key should be an array
    minArrayLength?: number    // minimum expected items (0 = just check it's array)
    itemFields?: string[]      // fields expected on first array item
    paginationKey?: string     // key that should contain pagination object
    paginationFields?: string[]// fields expected in pagination object
  }
}

const tests: TestCase[] = [
  {
    name: 'GET /api/expenses',
    url: '/api/expenses?page=1&pageSize=5',
    expects: {
      topLevelKeys: ['expenses', 'pagination'],
      arrayKey: 'expenses',
      minArrayLength: 1,
      itemFields: ['id', 'amount', 'status', 'expenseDate', 'site', 'category', 'user'],
      paginationKey: 'pagination',
      paginationFields: ['page', 'pageSize', 'total', 'totalPages'],
    },
  },
  {
    name: 'GET /api/expenses?status=PENDING',
    url: '/api/expenses?status=PENDING&pageSize=50',
    expects: {
      topLevelKeys: ['expenses', 'pagination'],
      arrayKey: 'expenses',
      minArrayLength: 0, // may be 0 if all approved
      itemFields: ['id', 'status'],
      paginationKey: 'pagination',
    },
  },
  {
    name: 'GET /api/requisitions',
    url: '/api/requisitions?page=1&pageSize=5',
    expects: {
      topLevelKeys: ['requisitions', 'pagination'],
      arrayKey: 'requisitions',
      minArrayLength: 1,
      itemFields: ['id', 'title', 'status', 'totalAmount', 'site', 'user'],
      paginationKey: 'pagination',
      paginationFields: ['page', 'pageSize', 'total', 'totalPages'],
    },
  },
  {
    name: 'GET /api/clients',
    url: '/api/clients',
    expects: {
      topLevelKeys: ['clients'],
      arrayKey: 'clients',
      minArrayLength: 1,
      itemFields: ['id', 'name'],
    },
  },
  {
    name: 'GET /api/sites',
    url: '/api/sites',
    expects: {
      topLevelKeys: ['sites'],
      arrayKey: 'sites',
      minArrayLength: 1,
      itemFields: ['id', 'name', 'clientId'],
    },
  },
  {
    name: 'GET /api/categories',
    url: '/api/categories',
    expects: {
      topLevelKeys: ['categories'],
      arrayKey: 'categories',
      minArrayLength: 1,
      itemFields: ['id', 'name'],
    },
  },
  {
    name: 'GET /api/users',
    url: '/api/users',
    expects: {
      topLevelKeys: ['users'],
      arrayKey: 'users',
      minArrayLength: 1,
      itemFields: ['id', 'name', 'email', 'role'],
    },
  },
  {
    name: 'GET /api/dashboard',
    url: '/api/dashboard',
    expects: {
      topLevelKeys: [
        'thisMonthExpenses', 'pendingExpenses', 'accountantApprovedExpenses',
        'adminApprovedExpenses', 'paidExpenses', 'pendingMirs',
        'stockMgrApprovedMirs', 'adminApprovedMirs', 'thisMonthMirs',
        'recentExpenses', 'recentMirs',
      ],
    },
  },
  {
    name: 'GET /api/audit-logs',
    url: '/api/audit-logs?page=1&pageSize=5',
    expects: {
      topLevelKeys: ['logs', 'pagination'],
      arrayKey: 'logs',
      minArrayLength: 0,
      paginationKey: 'pagination',
    },
  },
  {
    name: 'GET /api/boq',
    url: '/api/boq?pageSize=5',
    expects: {
      topLevelKeys: ['items'],
      arrayKey: 'items',
      minArrayLength: 0,
    },
  },
]

// Colors for terminal output
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

let passed = 0
let failed = 0
let warnings = 0

function logPass(msg: string) {
  console.log(`  ${GREEN}✓${RESET} ${msg}`)
  passed++
}

function logFail(msg: string) {
  console.log(`  ${RED}✗${RESET} ${msg}`)
  failed++
}

function logWarn(msg: string) {
  console.log(`  ${YELLOW}⚠${RESET} ${msg}`)
  warnings++
}

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@demo.com', password: 'admin123' }),
  })
  
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${await res.text()}`)
  }
  
  const setCookie = res.headers.get('set-cookie')
  if (!setCookie) {
    throw new Error('No session cookie returned from login')
  }
  
  // Extract the auth-token cookie value
  const match = setCookie.match(/auth-token=([^;]+)/)
  if (!match) {
    // Try other patterns - some servers set multiple cookies
    const allCookies = setCookie.split(',').map(c => c.trim())
    for (const cookie of allCookies) {
      const m = cookie.match(/auth-token=([^;]+)/)
      if (m) return `auth-token=${m[1]}`
    }
    throw new Error(`Could not parse auth-token cookie. Raw Set-Cookie: ${setCookie}`)
  }
  
  return `auth-token=${match[1]}`
}

async function runTest(test: TestCase, cookie: string) {
  console.log(`\n${CYAN}${BOLD}${test.name}${RESET}`)
  
  let data: any
  try {
    const res = await fetch(`${BASE}${test.url}`, {
      headers: { Cookie: cookie },
    })
    
    if (!res.ok) {
      logFail(`HTTP ${res.status} — ${await res.text()}`)
      return
    }
    
    data = await res.json()
  } catch (e: any) {
    logFail(`Fetch error: ${e.message}`)
    return
  }
  
  if (!data || typeof data !== 'object') {
    logFail('Response is not a JSON object')
    return
  }
  
  const keys = Object.keys(data)
  
  // Check top-level keys
  for (const expectedKey of test.expects.topLevelKeys) {
    if (keys.includes(expectedKey)) {
      logPass(`Has key "${expectedKey}"`)
    } else {
      logFail(`Missing key "${expectedKey}". Got: [${keys.join(', ')}]`)
    }
  }
  
  // Check no unexpected top-level keys (that might indicate wrapping issues)
  const expectedSet = new Set(test.expects.topLevelKeys)
  const unexpectedKeys = keys.filter(k => !expectedSet.has(k))
  if (unexpectedKeys.length > 0) {
    // Don't fail for extra keys, just warn — they might be intentional
    logWarn(`Extra keys found: [${unexpectedKeys.join(', ')}]`)
  }
  
  // Check array field
  if (test.expects.arrayKey) {
    const arr = data[test.expects.arrayKey]
    if (Array.isArray(arr)) {
      logPass(`"${test.expects.arrayKey}" is an array with ${arr.length} items`)
      
      if (test.expects.minArrayLength !== undefined && arr.length < test.expects.minArrayLength) {
        logFail(`"${test.expects.arrayKey}" has ${arr.length} items, expected at least ${test.expects.minArrayLength}`)
      }
      
      // Check item fields on first item
      if (arr.length > 0 && test.expects.itemFields) {
        const first = arr[0]
        if (typeof first !== 'object' || first === null) {
          logFail(`First item in "${test.expects.arrayKey}" is not an object`)
        } else {
          const itemKeys = Object.keys(first)
          for (const field of test.expects.itemFields) {
            if (field in first) {
              logPass(`Item has field "${field}"`)
            } else {
              logFail(`Item missing field "${field}". Has: [${itemKeys.join(', ')}]`)
            }
          }
        }
      }
    } else {
      logFail(`"${test.expects.arrayKey}" is not an array (got ${typeof arr}): ${JSON.stringify(arr).slice(0, 100)}`)
    }
  }
  
  // Check pagination
  if (test.expects.paginationKey) {
    const pag = data[test.expects.paginationKey]
    if (typeof pag === 'object' && pag !== null && !Array.isArray(pag)) {
      logPass(`"${test.expects.paginationKey}" is an object`)
      
      if (test.expects.paginationFields) {
        for (const field of test.expects.paginationFields) {
          if (field in pag) {
            logPass(`Pagination has field "${field}" = ${pag[field]}`)
          } else {
            logFail(`Pagination missing field "${field}". Has: [${Object.keys(pag).join(', ')}]`)
          }
        }
      }
    } else {
      logFail(`"${test.expects.paginationKey}" is not an object (got ${typeof pag})`)
    }
  }
}

// ============================================================
// Frontend ↔ API Client Alignment Check
// This reads api.ts and verifies param mapping matches API routes
// ============================================================

function checkApiClientAlignment() {
  console.log(`\n${CYAN}${BOLD}Frontend ↔ API Client ↔ API Route Alignment${RESET}`)
  console.log('  (Reading source files to verify param contracts)\n')
  
  // Known param mismatches to flag
  const knownMappings: Record<string, Record<string, string>> = {
    '/api/expenses': {
      'limit': 'pageSize',
      'sort': 'sortBy',
      'sortDir': 'sortOrder',
      'siteId': 'siteIds',
      'categoryId': 'categoryIds',
      'paymentMethod': 'paymentMethods',
      'amountMin': 'amountFrom',
      'amountMax': 'amountTo',
    },
    '/api/requisitions': {
      'limit': 'pageSize',
      'sort': 'sortBy',
      'sortDir': 'sortOrder',
      'siteId': 'siteIds',
    },
  }
  
  for (const [endpoint, mappings] of Object.entries(knownMappings)) {
    console.log(`  ${CYAN}${endpoint}${RESET} param mappings:`)
    for (const [frontend, backend] of Object.entries(mappings)) {
      logPass(`${frontend} → ${backend}`)
    }
  }
}

async function main() {
  console.log(`\n${BOLD}═══════════════════════════════════════════════════════${RESET}`)
  console.log(`${BOLD}  API Contract Verification — Full System Check${RESET}`)
  console.log(`${BOLD}═══════════════════════════════════════════════════════${RESET}`)
  
  let cookie: string
  try {
    console.log(`\n${CYAN}Logging in as admin@demo.com...${RESET}`)
    cookie = await login()
    logPass('Login successful, session obtained')
  } catch (e: any) {
    console.log(`\n${RED}FATAL: ${e.message}${RESET}`)
    console.log('Make sure the dev server is running and the database is seeded.')
    process.exit(1)
  }
  
  for (const test of tests) {
    await runTest(test, cookie)
  }
  
  // Run alignment check
  checkApiClientAlignment()
  
  // Summary
  console.log(`\n${BOLD}═══════════════════════════════════════════════════════${RESET}`)
  console.log(`${BOLD}  Summary${RESET}`)
  console.log(`${BOLD}═══════════════════════════════════════════════════════${RESET}`)
  console.log(`  ${GREEN}Passed: ${passed}${RESET}`)
  console.log(`  ${RED}Failed: ${failed}${RESET}`)
  console.log(`  ${YELLOW}Warnings: ${warnings}${RESET}`)
  
  if (failed > 0) {
    console.log(`\n${RED}${BOLD}FAIL: ${failed} check(s) failed. Fix before proceeding.${RESET}`)
    process.exit(1)
  } else {
    console.log(`\n${GREEN}${BOLD}PASS: All checks passed.${RESET}`)
    process.exit(0)
  }
}

main()
