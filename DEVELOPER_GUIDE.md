# S.S. Electricals — Expense Management System
## Developer Guide (Complete Specification)

> **Version**: 1.2  
> **Last Updated**: 2025  
> **Currency**: INR (₹) — Always and only  
> **Approximate Users**: ~30 employees  
> **Custom Domain**: sselectricals.in (optional; Vercel default domain is fine)

---

## Table of Contents

1. [Company Overview](#1-company-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture](#3-architecture)
4. [Database Schema (COMPLETE)](#4-database-schema-complete)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [User Roles & Demo Accounts](#6-user-roles--demo-accounts)
7. [Features (DETAILED)](#7-features-detailed)
8. [API Routes (COMPLETE LIST)](#8-api-routes-complete-list)
9. [Multi-Language Support](#9-multi-language-support)
10. [File Upload & Storage](#10-file-upload--storage)
11. [Export Capabilities](#11-export-capabilities)
12. [Deployment Guide](#12-deployment-guide)
13. [Business Rules](#13-business-rules)
14. [Responsive Design](#14-responsive-design)
15. [Key Design Decisions](#15-key-design-decisions)
16. [Seed Data](#16-seed-data)
17. [File Structure (COMPLETE)](#17-file-structure-complete)

---

## 1. Company Overview

- **Company Name**: S.S. Electricals
- **Business**: Electrical construction company (commercial towers, bridge renovation, residential complexes, malls, tech parks, luxury villas)
- **Purpose**: Internal expense management, material requisition, advance tracking, HR/employee management
- **Branding**:
  - Text-based logo with **"S.S."** monogram inside a rounded square (`bg-stone-900`)
  - **Lightning bolt accent** in amber (`#f59e0b`) overlaid on the monogram SVG
  - Full text: **"S.S. Electricals"** with subtitle **"Expense Management"**
  - Primary dark color: `stone-900`
  - Accent color: `amber-500` / `amber-600`
  - Login button: `bg-amber-600 hover:bg-amber-700`
  - Active nav item: `bg-stone-900 text-white font-medium`
- **Single Company**: No multi-tenant architecture. One company, one database.

---

## 2. Technology Stack

| Technology | Version | Purpose |
|---|---|---|
| **Next.js** | 16.1.1 | App Router, Server Components, API Routes |
| **React** | 19.0.0 | UI library |
| **TypeScript** | 5 | Strict typing throughout |
| **Tailwind CSS** | 4 | Utility-first styling with CSS variables theme |
| **shadcn/ui** | New York style | 50+ pre-built UI components |
| **Prisma ORM** | 6.11.1 | Type-safe database client and migrations |
| **SQLite** | — | Local development database (file-based) |
| **@libsql/client** | 0.17.2 | Turso (libSQL) adapter for production |
| **@prisma/adapter-libsql** | ^6.19.3 | Prisma adapter for Turso (MUST match @prisma/client version) |
| **TanStack Query** | 5.82.0 | Server state management (React Query) |
| **Zustand** | 5.0.6 | Client state management |
| **Recharts** | 2.15.4 | Charts (bar, pie, line) for dashboard/reports |
| **xlsx** | 0.18.5 | Excel import/export (bulk upload, template generation) |
| **jsPDF** | 4.2.1 | PDF generation for exports |
| **jspdf-autotable** | 5.0.7 | Table rendering in PDFs |
| **lucide-react** | 0.525.0 | Icon library |
| **next-themes** | — | Dark mode support |
| **date-fns** | 4.1.0 | Date formatting and manipulation |
| **react-day-picker** | 9 | Calendar date picker |
| **uuid** | 11.1.0 | Unique ID generation |
| **z-ai-web-dev-sdk** | 0.0.17 | AI SDK (backend only, for AI features) |
| **class-variance-authority** | 0.7.1 | Component variant management (shadcn) |
| **clsx** | 2.1.1 | Conditional class names |
| **tailwind-merge** | 3.3.1 | Tailwind class merging |
| **sonner** | 2.0.6 | Toast notifications (alternative) |
| **Bun** | — | Runtime and package manager |

### NPM Scripts

```json
{
  "dev": "next dev -p 3000 2>&1 | tee dev.log",
  "build": "next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/",
  "start": "NODE_ENV=production bun .next/standalone/server.js 2>&1 | tee server.log",
  "lint": "eslint .",
  "db:push": "prisma db push",
  "db:generate": "prisma generate",
  "db:migrate": "prisma migrate dev",
  "db:reset": "prisma migrate reset"
}
```

---

## 3. Architecture

### 3.1 Single-Page Application (SPA) Pattern

The entire app runs on a **single route** (`/`). There are no separate Next.js page routes. Navigation is handled via client-side tab switching with React state.

```
src/app/page.tsx  →  The ONLY route
                    ├── LoginPage (unauthenticated)
                    └── Layout (authenticated)
                        ├── Sidebar navigation
                        ├── Header (notifications, language, logout)
                        ├── Main content area (tab switching)
                        └── Footer
```

### 3.2 Lazy Loading

All page components are **lazy-loaded** using `React.lazy()` with `Suspense` boundaries. This reduces initial compilation memory usage:

```tsx
const DashboardPage = lazy(() => import('@/components/expense-manager/dashboard-page').then(m => ({ default: m.DashboardPage })))
const ExpensesPage = lazy(() => import('@/components/expense-manager/expenses-page').then(m => ({ default: m.ExpensesPage })))
// ... etc for all 12 page components
```

### 3.3 Routing Pattern

Each lazy-loaded component exports a **named export** (not default), accessed via `.then(m => ({ default: m.ComponentName }))`.

### 3.4 Directory Structure Pattern

```
src/
├── app/
│   ├── page.tsx              # Single route entry point
│   ├── layout.tsx            # Root layout (fonts, providers, toaster)
│   ├── globals.css           # Theme variables, print styles
│   └── api/                  # All API routes
│       ├── auth/             # Authentication endpoints
│       ├── users/            # User CRUD
│       ├── clients/          # Client CRUD
│       ├── sites/            # Site CRUD
│       ├── categories/       # Category CRUD
│       ├── expenses/         # Expense CRUD + actions
│       ├── advances/         # Advance CRUD + actions
│       ├── requisitions/     # Requisition CRUD + actions
│       ├── boq/              # BOQ items view
│       ├── employees/        # Employee CRUD
│       ├── salaries/         # Salary CRUD + mark-paid
│       ├── attendance/       # Attendance CRUD + bulk-mark
│       ├── leaves/           # Leave CRUD + approve/reject/cancel
│       ├── dashboard/        # Dashboard stats + reports
│       ├── comments/         # Comment thread
│       ├── audit-logs/       # Audit log viewer
│       ├── balances/         # User balance endpoint
│       └── seed/             # Database seeder
├── components/
│   ├── ui/                   # shadcn/ui components (50+ files)
│   ├── expense-manager/      # Page components (14 files)
│   ├── logo.tsx              # SVG logo component
│   ├── providers.tsx         # QueryClient + LanguageProvider
│   ├── comment-thread.tsx    # Reusable comment thread component
│   └── bulk-upload-dialog.tsx # Reusable bulk upload dialog
├── hooks/
│   ├── use-auth.tsx          # Auth context + provider
│   ├── use-language.tsx      # Language context + provider
│   ├── use-toast.ts          # Toast notification hook
│   └── use-mobile.ts         # Mobile detection hook
└── lib/
    ├── api.ts                # Frontend API client (class-based)
    ├── auth.ts               # Backend auth utilities
    ├── db.ts                 # Prisma client singleton (auto-detects Turso vs SQLite)
    ├── i18n.ts               # Translation strings (en/hi)
    ├── audit.ts              # Audit log creation utility
    ├── export.ts             # CSV/XLS/PDF export utilities
    └── utils.ts              # General utilities (cn, etc.)
```

### 3.5 Provider Hierarchy

```tsx
// Root Layout (app/layout.tsx)
<html>
  <body>
    <Providers>          {/* QueryClientProvider + LanguageProvider */}
      {children}
      <Toaster />        {/* shadcn/ui toast notifications */}
    </Providers>
  </body>
</html>
```

### 3.6 Page Level Provider

```tsx
// app/page.tsx
<AuthProvider>          {/* Auth context (login, logout, permissions) */}
  <AppContent>          {/* Tab switching logic */}
    <Layout>            {/* Sidebar + Header + Footer */}
      <Suspense>        {/* Lazy-loaded page component */}
    </Layout>
  </AppContent>
</AuthProvider>
```

---

## 4. Database Schema (COMPLETE)

### 4.1 Enums (10 total)

#### `Role`
| Value | Description |
|---|---|
| `ADMIN` | Full system access (19 permissions) |
| `ACCOUNTANT` | Expense management, salary, HR data |
| `STOCK_MANAGER` | Material requisition management |
| `USER` | Own data only |

#### `ExpenseStatus`
| Value | Description |
|---|---|
| `PENDING` | Newly submitted, awaiting accountant review |
| `ACCOUNTANT_APPROVED` | Approved by accountant, awaiting admin |
| `ADMIN_APPROVED` | Approved by admin, awaiting payment |
| `REJECTED` | Rejected (with reason) |
| `RETURNED` | Returned to submitter for correction (with reason) |
| `PAID` | Payment completed |

#### `RequisitionStatus`
| Value | Description |
|---|---|
| `PENDING` | Newly submitted, awaiting stock manager |
| `STOCK_MANAGER_APPROVED` | Approved by stock manager, awaiting admin |
| `ADMIN_APPROVED` | Approved by admin, awaiting ordering |
| `REJECTED` | Rejected (with reason) |
| `RETURNED` | Returned for correction (with reason) |
| `ORDERED` | Materials ordered from supplier |
| `RECEIVED` | Materials received at site |

#### `PaymentMethod`
| Value | Description |
|---|---|
| `CASH` | Cash payment |
| `UPI` | UPI digital payment |
| `CREDIT` | Credit/purchase on credit |
| `OFFICE` | Office account / company payment |

#### `Priority`
| Value | Description |
|---|---|
| `LOW` | Low priority |
| `MEDIUM` | Normal priority (default) |
| `HIGH` | High priority |
| `URGENT` | Urgent — needs immediate attention |

#### `CategoryType`
| Value | Description |
|---|---|
| `EXPENSE` | Only used for expenses |
| `REQUISITION` | Only used for requisitions |
| `BOTH` | Used for both expenses and requisitions |

#### `AdvanceStatus`
| Value | Description |
|---|---|
| `PENDING` | Newly submitted |
| `APPROVED` | Approved by accountant (auto-marks as PAID in the simplified flow) |
| `PAID` | Payment completed |
| `REJECTED` | Rejected (with reason) |
| `RETURNED` | Returned for correction (with reason) |

#### `LeaveType`
| Value | Description |
|---|---|
| `CASUAL` | Casual leave |
| `SICK` | Sick leave |
| `EARNED` | Earned leave |
| `HALF_DAY` | Half-day leave |

#### `LeaveStatus`
| Value | Description |
|---|---|
| `PENDING` | Awaiting approval |
| `APPROVED` | Leave approved |
| `REJECTED` | Leave rejected (with reason) |
| `CANCELLED` | Leave cancelled by employee |

#### `AttendanceStatus`
| Value | Description |
|---|---|
| `PRESENT` | Present at work |
| `ABSENT` | Absent |
| `HALF_DAY` | Half day attendance |
| `HOLIDAY` | Public holiday |
| `WEEK_OFF` | Weekly off (Sunday) |
| `LEAVE` | On approved leave |

### 4.2 Models (15 total)

---

#### Model: `User`
Primary user accounts table. Every user who logs in has a record here.

| Field | Type | Default | Constraints | Description |
|---|---|---|---|---|
| `id` | `String` | `cuid()` | `@id` | Primary key |
| `email` | `String` | — | `@unique` | Login email (lowercase) |
| `password` | `String` | — | — | SHA-256 hashed password |
| `name` | `String` | — | — | Display name |
| `role` | `Role` | `USER` | — | User role enum |
| `isActive` | `Boolean` | `true` | — | Soft-disable accounts |
| `token` | `String?` | — | `@unique` | Current auth session token |
| `tokenExpiry` | `DateTime?` | — | — | Token expiration (7 days) |
| `lastLogin` | `DateTime?` | — | — | Last login timestamp |
| `createdAt` | `DateTime` | `now()` | — | Record creation |
| `updatedAt` | `DateTime` | `updatedAt` | — | Auto-update timestamp |

**Relations:**
- `expenses` → `Expense[]` (one-to-many: expenses submitted by this user)
- `requisitions` → `Requisition[]` (one-to-many: requisitions submitted by this user)
- `advances` → `Advance[]` (one-to-many: advances requested by this user)
- `auditLogs` → `AuditLog[]` (one-to-many: audit trail)
- `comments` → `Comment[]` (one-to-many: comments posted)
- `accountantApprovals` → `Expense[]` (one-to-many: expenses approved as accountant)
- `adminExpenseApprovals` → `Expense[]` (one-to-many: expenses approved as admin)
- `adminMirApprovals` → `Requisition[]` (one-to-many: MIRs approved as admin)
- `stockMgrApprovals` → `Requisition[]` (one-to-many: MIRs approved as stock manager)
- `advanceAcctApprovals` → `Advance[]` (one-to-many: advances approved as accountant)
- `advanceAdminApprovals` → `Advance[]` (one-to-many: advances approved as admin)
- `advancePaidApprovals` → `Advance[]` (one-to-many: advances marked paid)
- `employee` → `Employee?` (one-to-one: linked employee profile)
- `leaveApprovals` → `Leave[]` (one-to-many: leaves approved)

---

#### Model: `Client`
Client companies that S.S. Electricals does construction work for.

| Field | Type | Default | Constraints | Description |
|---|---|---|---|---|
| `id` | `String` | `cuid()` | `@id` | Primary key |
| `name` | `String` | — | — | Client company name |
| `description` | `String?` | — | — | Optional description |
| `isActive` | `Boolean` | `true` | — | Soft-disable |
| `createdAt` | `DateTime` | `now()` | — | Record creation |
| `updatedAt` | `DateTime` | `updatedAt` | — | Auto-update timestamp |

**Relations:**
- `sites` → `Site[]` (one-to-many: sites belonging to this client)

---

#### Model: `Site`
Construction project sites. Each site belongs to exactly one client.

| Field | Type | Default | Constraints | Description |
|---|---|---|---|---|
| `id` | `String` | `cuid()` | `@id` | Primary key |
| `name` | `String` | — | — | Site name |
| `clientId` | `String` | — | FK → `Client.id` | Parent client |
| `location` | `String?` | — | — | Physical address/location |
| `description` | `String?` | — | — | Project description |
| `budget` | `Float` | `0` | — | Project budget (₹) |
| `isActive` | `Boolean` | `true` | — | Soft-disable |
| `createdAt` | `DateTime` | `now()` | — | Record creation |
| `updatedAt` | `DateTime` | `updatedAt` | — | Auto-update timestamp |

**Relations:**
- `client` → `Client` (many-to-one: parent client)
- `expenses` → `Expense[]` (one-to-many)
- `requisitions` → `Requisition[]` (one-to-many)
- `advances` → `Advance[]` (one-to-many)

**Indexes:** `@@index([clientId])`

---

#### Model: `Category`
Expense and/or requisition categories.

| Field | Type | Default | Constraints | Description |
|---|---|---|---|---|
| `id` | `String` | `cuid()` | `@id` | Primary key |
| `name` | `String` | — | — | Category name |
| `type` | `CategoryType` | `BOTH` | — | EXPENSE, REQUISITION, or BOTH |
| `description` | `String?` | — | — | Optional description |
| `isActive` | `Boolean` | `true` | — | Soft-disable |
| `createdAt` | `DateTime` | `now()` | — | Record creation |
| `updatedAt` | `DateTime` | `updatedAt` | — | Auto-update timestamp |

**Relations:**
- `expenses` → `Expense[]` (one-to-many)

---

#### Model: `Expense`
The core expense record. Each expense belongs to a site, category, and user.

| Field | Type | Default | Constraints | Description |
|---|---|---|---|---|
| `id` | `String` | `cuid()` | `@id` | Primary key |
| `siteId` | `String` | — | FK → `Site.id` | Project site |
| `categoryId` | `String` | — | FK → `Category.id` | Expense category |
| `userId` | `String` | — | FK → `User.id` | Submitted by |
| `amount` | `Float` | — | — | Amount in ₹ |
| `description` | `String` | — | — | Expense description |
| `expenseDate` | `DateTime` | — | — | When the expense occurred |
| `submissionDate` | `DateTime` | `now()` | — | When submitted to system |
| `sellerName` | `String?` | — | — | Seller/vendor name |
| `invoiceNumber` | `String?` | — | — | Invoice/reference number |
| `paymentMethod` | `PaymentMethod` | `CASH` | — | How it was paid |
| `status` | `ExpenseStatus` | `PENDING` | — | Current workflow status |
| `receiptUrl` | `String?` | — | — | Base64 data URI of receipt |
| `receiptFileName` | `String?` | — | — | Original filename |
| `notes` | `String?` | — | — | Additional notes |
| `accountantApprovedById` | `String?` | — | FK → `User.id` | Who approved (accountant) |
| `accountantApprovedAt` | `DateTime?` | — | — | When accountant approved |
| `adminApprovedById` | `String?` | — | FK → `User.id` | Who approved (admin) |
| `adminApprovedAt` | `DateTime?` | — | — | When admin approved |
| `rejectionReason` | `String?` | — | — | Reason for rejection |
| `returnReason` | `String?` | — | — | Reason for return |
| `isLateSubmission` | `Boolean` | `false` | — | Late submission flag |
| `daysLate` | `Int` | `0` | — | Days late (if >0) |
| `createdAt` | `DateTime` | `now()` | — | Record creation |
| `updatedAt` | `DateTime` | `updatedAt` | — | Auto-update timestamp |

**Relations:**
- `site` → `Site` (many-to-one, includes `client`)
- `category` → `Category` (many-to-one)
- `user` → `User` (many-to-one: who submitted)
- `accountantApprovedBy` → `User?` (many-to-one: "AccountantApprovals")
- `adminApprovedBy` → `User?` (many-to-one: "AdminExpenseApprovals")

**Indexes:** `@@index([siteId])`, `@@index([categoryId])`, `@@index([userId])`, `@@index([status])`

---

#### Model: `Requisition`
Material requisition requests (MIRs). Each belongs to a site and user.

| Field | Type | Default | Constraints | Description |
|---|---|---|---|---|
| `id` | `String` | `cuid()` | `@id` | Primary key |
| `siteId` | `String` | — | FK → `Site.id` | Project site |
| `userId` | `String` | — | FK → `User.id` | Submitted by |
| `title` | `String` | — | — | MIR title |
| `description` | `String?` | — | — | MIR description |
| `requiredDate` | `DateTime` | — | — | Materials needed by |
| `priority` | `Priority` | `MEDIUM` | — | LOW/MEDIUM/HIGH/URGENT |
| `status` | `RequisitionStatus` | `PENDING` | — | Workflow status |
| `totalAmount` | `Float` | `0` | — | Sum of BOQ items |
| `notes` | `String?` | — | — | Additional notes |
| `attachmentUrl` | `String?` | — | — | Base64 attachment data URI |
| `attachmentName` | `String?` | — | — | Original filename |
| `stockManagerApprovedById` | `String?` | — | FK → `User.id` | Stock manager approver |
| `stockManagerApprovedAt` | `DateTime?` | — | — | SM approval timestamp |
| `adminApprovedById` | `String?` | — | FK → `User.id` | Admin approver |
| `adminApprovedAt` | `DateTime?` | — | — | Admin approval timestamp |
| `rejectionReason` | `String?` | — | — | Rejection reason |
| `returnReason` | `String?` | — | — | Return reason |
| `createdAt` | `DateTime` | `now()` | — | Record creation |
| `updatedAt` | `DateTime` | `updatedAt` | — | Auto-update timestamp |

**Relations:**
- `site` → `Site` (many-to-one)
- `user` → `User` (many-to-one)
- `boqItems` → `BOQItem[]` (one-to-many: Bill of Quantities items)
- `stockManagerApprovedBy` → `User?` ("StockMgrApprovals")
- `adminApprovedBy` → `User?` ("AdminMirApprovals")

**Indexes:** `@@index([siteId])`, `@@index([userId])`, `@@index([status])`

---

#### Model: `BOQItem`
Individual line items within a requisition (Bill of Quantities).

| Field | Type | Default | Constraints | Description |
|---|---|---|---|---|
| `id` | `String` | `cuid()` | `@id` | Primary key |
| `requisitionId` | `String` | — | FK → `Requisition.id` (cascade) | Parent requisition |
| `itemName` | `String` | — | — | Item name |
| `description` | `String?` | — | — | Item description |
| `quantity` | `Float` | — | — | Quantity |
| `unit` | `String` | — | — | Unit of measurement |
| `unitPrice` | `Float` | — | — | Price per unit (₹) |
| `totalPrice` | `Float` | — | — | quantity × unitPrice |
| `category` | `String?` | — | — | Item category |
| `notes` | `String?` | — | — | Item notes |
| `createdAt` | `DateTime` | `now()` | — | Record creation |
| `updatedAt` | `DateTime` | `updatedAt` | — | Auto-update timestamp |

**Relations:**
- `requisition` → `Requisition` (many-to-one, `onDelete: Cascade`)

**Indexes:** `@@index([requisitionId])`

---

#### Model: `Advance`
Cash advance requests from users.

| Field | Type | Default | Constraints | Description |
|---|---|---|---|---|
| `id` | `String` | `cuid()` | `@id` | Primary key |
| `userId` | `String` | — | FK → `User.id` | Requested by |
| `siteId` | `String` | — | FK → `Site.id` | For which site |
| `amount` | `Float` | — | — | Advance amount (₹) |
| `purpose` | `String` | — | — | Purpose of advance |
| `status` | `AdvanceStatus` | `PENDING` | — | PENDING/APPROVED/PAID/REJECTED/RETURNED |
| `notes` | `String?` | — | — | Additional notes |
| `accountantApprovedById` | `String?` | — | FK → `User.id` | Accountant approver |
| `accountantApprovedAt` | `DateTime?` | — | — | Approval timestamp |
| `adminApprovedById` | `String?` | — | FK → `User.id` | Admin approver |
| `adminApprovedAt` | `DateTime?` | — | — | Admin approval timestamp |
| `paidById` | `String?` | — | FK → `User.id` | Who marked as paid |
| `paidAt` | `DateTime?` | — | — | Payment timestamp |
| `rejectionReason` | `String?` | — | — | Rejection reason |
| `returnReason` | `String?` | — | — | Return reason |
| `createdAt` | `DateTime` | `now()` | — | Record creation |
| `updatedAt` | `DateTime` | `updatedAt` | — | Auto-update timestamp |

**Relations:**
- `user` → `User` (many-to-one)
- `site` → `Site` (many-to-one)
- `accountantApprovedBy` → `User?` ("AdvanceAcctApprovals")
- `adminApprovedBy` → `User?` ("AdvanceAdminApprovals")
- `paidBy` → `User?` ("AdvancePaidBy")

**Indexes:** `@@index([userId])`, `@@index([siteId])`, `@@index([status])`

---

#### Model: `Comment`
Comments attached to expenses, advances, or requisitions.

| Field | Type | Default | Constraints | Description |
|---|---|---|---|---|
| `id` | `String` | `cuid()` | `@id` | Primary key |
| `entityType` | `String` | — | — | "EXPENSE", "ADVANCE", or "REQUISITION" |
| `entityId` | `String` | — | — | ID of the parent entity |
| `userId` | `String` | — | FK → `User.id` | Comment author |
| `content` | `String` | — | — | Comment text |
| `createdAt` | `DateTime` | `now()` | — | Comment timestamp |

**Relations:**
- `user` → `User` (many-to-one)

**Indexes:** `@@index([entityType])`, `@@index([entityId])`, `@@index([userId])`

---

#### Model: `Employee`
Extended employee profiles linked to user accounts.

| Field | Type | Default | Constraints | Description |
|---|---|---|---|---|
| `id` | `String` | `cuid()` | `@id` | Primary key |
| `userId` | `String` | — | `@unique`, FK → `User.id` | Linked user account |
| `employeeCode` | `String` | — | `@unique` | Auto-generated (SSE-001, SSE-002...) |
| `designation` | `String` | — | — | Job designation |
| `department` | `String?` | — | — | Department name |
| `phone` | `String?` | — | — | Phone number |
| `address` | `String?` | — | — | Home address |
| `joiningDate` | `DateTime` | `now()` | — | Date of joining |
| `baseSalary` | `Float` | `0` | — | Monthly base salary (₹) |
| `bankAccount` | `String?` | — | — | Bank account number |
| `bankName` | `String?` | — | — | Bank name |
| `bankIfsc` | `String?` | — | — | IFSC code |
| `panNumber` | `String?` | — | — | PAN number |
| `aadhaarNumber` | `String?` | — | — | Aadhaar number |
| `isActive` | `Boolean` | `true` | — | Soft-disable |
| `createdAt` | `DateTime` | `now()` | — | Record creation |
| `updatedAt` | `DateTime` | `updatedAt` | — | Auto-update timestamp |

**Relations:**
- `user` → `User` (one-to-one)
- `salaries` → `Salary[]` (one-to-many)
- `attendances` → `Attendance[]` (one-to-many)
- `leaves` → `Leave[]` (one-to-many)

**Indexes:** `@@index([userId])`, `@@index([employeeCode])`, `@@index([designation])`

---

#### Model: `Salary`
Monthly salary records for employees.

| Field | Type | Default | Constraints | Description |
|---|---|---|---|---|
| `id` | `String` | `cuid()` | `@id` | Primary key |
| `employeeId` | `String` | — | FK → `Employee.id` (cascade) | Employee |
| `month` | `String` | — | — | Month in "YYYY-MM" format |
| `baseSalary` | `Float` | — | — | Base salary (₹) |
| `hra` | `Float` | `0` | — | House Rent Allowance |
| `da` | `Float` | `0` | — | Dearness Allowance |
| `ta` | `Float` | `0` | — | Travel Allowance |
| `bonus` | `Float` | `0` | — | Bonus |
| `deductions` | `Float` | `0` | — | Other deductions |
| `pf` | `Float` | `0` | — | Provident Fund |
| `tds` | `Float` | `0` | — | Tax Deducted at Source |
| `advanceDeduction` | `Float` | `0` | — | Advance deduction |
| `netSalary` | `Float` | — | — | Auto-calculated: base+hra+da+ta+bonus-deductions-pf-tds-advanceDeduction |
| `paidDate` | `DateTime?` | — | — | When salary was paid |
| `status` | `String` | `"PENDING"` | — | PENDING or PAID |
| `paymentMethod` | `String` | `"BANK_TRANSFER"` | — | Payment method |
| `notes` | `String?` | — | — | Notes |
| `createdAt` | `DateTime` | `now()` | — | Record creation |
| `updatedAt` | `DateTime` | `updatedAt` | — | Auto-update timestamp |

**Relations:**
- `employee` → `Employee` (many-to-one, `onDelete: Cascade`)

**Indexes:** `@@index([employeeId])`, `@@index([month])`, `@@index([status])`

---

#### Model: `Attendance`
Daily attendance records.

| Field | Type | Default | Constraints | Description |
|---|---|---|---|---|
| `id` | `String` | `cuid()` | `@id` | Primary key |
| `employeeId` | `String` | — | FK → `Employee.id` (cascade) | Employee |
| `date` | `DateTime` | — | — | Attendance date |
| `checkIn` | `DateTime?` | — | — | Check-in time |
| `checkOut` | `DateTime?` | — | — | Check-out time |
| `status` | `AttendanceStatus` | `PRESENT` | — | Attendance status |
| `hoursWorked` | `Float` | `0` | — | Hours worked |
| `overtimeHours` | `Float` | `0` | — | Overtime hours |
| `notes` | `String?` | — | — | Notes |
| `createdAt` | `DateTime` | `now()` | — | Record creation |
| `updatedAt` | `DateTime` | `updatedAt` | — | Auto-update timestamp |

**Unique constraint:** `@@unique([employeeId, date])` — only one record per employee per date.

**Relations:**
- `employee` → `Employee` (many-to-one, `onDelete: Cascade`)

**Indexes:** `@@index([employeeId])`, `@@index([date])`, `@@index([status])`

---

#### Model: `Leave`
Leave requests from employees.

| Field | Type | Default | Constraints | Description |
|---|---|---|---|---|
| `id` | `String` | `cuid()` | `@id` | Primary key |
| `employeeId` | `String` | — | FK → `Employee.id` (cascade) | Employee |
| `type` | `LeaveType` | `CASUAL` | — | CASUAL/SICK/EARNED/HALF_DAY |
| `startDate` | `DateTime` | — | — | Leave start date |
| `endDate` | `DateTime` | — | — | Leave end date |
| `totalDays` | `Float` | `1` | — | Auto-calculated days |
| `reason` | `String?` | — | — | Leave reason |
| `status` | `LeaveStatus` | `PENDING` | — | PENDING/APPROVED/REJECTED/CANCELLED |
| `approvedById` | `String?` | — | FK → `User.id` | Approver |
| `approvedAt` | `DateTime?` | — | — | Approval timestamp |
| `rejectionReason` | `String?` | — | — | Rejection reason |
| `createdAt` | `DateTime` | `now()` | — | Record creation |
| `updatedAt` | `DateTime` | `updatedAt` | — | Auto-update timestamp |

**Relations:**
- `employee` → `Employee` (many-to-one, `onDelete: Cascade`)
- `approvedBy` → `User?` ("LeaveApprover")

**Indexes:** `@@index([employeeId])`, `@@index([status])`, `@@index([startDate])`

---

#### Model: `AuditLog`
Complete audit trail of all significant actions.

| Field | Type | Default | Constraints | Description |
|---|---|---|---|---|
| `id` | `String` | `cuid()` | `@id` | Primary key |
| `userId` | `String` | — | FK → `User.id` | Who performed the action |
| `action` | `String` | — | — | Action type (e.g., "CREATE_EXPENSE") |
| `entityType` | `String` | — | — | Entity type (e.g., "EXPENSE") |
| `entityId` | `String?` | — | — | ID of affected entity |
| `oldValues` | `String?` | — | — | JSON string of previous values |
| `newValues` | `String?` | — | — | JSON string of new values |
| `ipAddress` | `String?` | — | — | Client IP address |
| `createdAt` | `DateTime` | `now()` | — | Action timestamp |

**Relations:**
- `user` → `User` (many-to-one)

**Indexes:** `@@index([userId])`, `@@index([action])`, `@@index([entityType])`, `@@index([createdAt])`

---

### 4.3 Relation Summary

```
Client 1──N Site
Site 1──N Expense, Requisition, Advance
Category 1──N Expense
User 1──N Expense, Requisition, Advance, AuditLog, Comment, Leave (approver)
User 1──1 Employee
Employee 1──N Salary, Attendance, Leave
Requisition 1──N BOQItem (cascade delete)
Expense N──1 User (accountantApprover, adminApprover)
Requisition N──1 User (stockManagerApprover, adminApprover)
Advance N──1 User (accountantApprover, adminApprover, paidBy)
```

---

## 5. Authentication & Authorization

### 5.1 Authentication Flow

1. **Login**: User submits email + password
2. **Hash verification**: Password is hashed with SHA-256 and compared to stored hash
3. **Token generation**: UUID + timestamp + random string → stored in `User.token`
4. **Cookie set**: `auth-token` cookie (httpOnly, secure in production, sameSite: lax, 7-day maxAge)
5. **Session check**: Every API route calls `getSession()` which reads the cookie, finds the user, checks `isActive` and `tokenExpiry`

### 5.2 Password Hashing

Uses **Web Crypto API** (`crypto.subtle.digest('SHA-256', data)`):

```typescript
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

### 5.3 Token Generation

```typescript
export function generateToken(): string {
  return crypto.randomUUID() + '-' + Date.now() + '-' + Math.random().toString(36).substring(2);
}
```

Token expiry: **7 days** from login.

### 5.4 Permission System

**19 permissions** mapped to 4 roles:

| # | Permission | ADMIN | ACCOUNTANT | STOCK_MANAGER | USER |
|---|---|---|---|---|---|
| 1 | `VIEW_ALL_EXPENSES` | ✅ | ✅ | ❌ | ❌ |
| 2 | `VIEW_OWN_EXPENSES` | ✅ | ✅ | ✅ | ✅ |
| 3 | `SUBMIT_EXPENSE` | ✅ | ✅ | ✅ | ✅ |
| 4 | `ACCOUNTANT_APPROVE_EXPENSE` | ✅ | ✅ | ❌ | ❌ |
| 5 | `ADMIN_APPROVE_EXPENSE` | ✅ | ❌ | ❌ | ❌ |
| 6 | `MARK_EXPENSE_PAID` | ✅ | ✅ | ❌ | ❌ |
| 7 | `VIEW_ALL_MIRS` | ✅ | ❌ | ✅ | ❌ |
| 8 | `VIEW_OWN_MIRS` | ✅ | ✅ | ✅ | ✅ |
| 9 | `SUBMIT_MIR` | ✅ | ✅ | ✅ | ✅ |
| 10 | `STOCK_MANAGER_APPROVE_MIR` | ✅ | ❌ | ✅ | ❌ |
| 11 | `ADMIN_APPROVE_MIR` | ✅ | ❌ | ❌ | ❌ |
| 12 | `ORDER_MIR` | ✅ | ❌ | ✅ | ❌ |
| 13 | `RECEIVE_MIR` | ✅ | ❌ | ✅ | ❌ |
| 14 | `MANAGE_USERS` | ✅ | ❌ | ❌ | ❌ |
| 15 | `MANAGE_CLIENTS` | ✅ | ❌ | ❌ | ❌ |
| 16 | `MANAGE_SITES` | ✅ | ❌ | ❌ | ❌ |
| 17 | `MANAGE_CATEGORIES` | ✅ | ❌ | ❌ | ❌ |
| 18 | `VIEW_AUDIT_LOGS` | ✅ | ❌ | ❌ | ❌ |
| 19 | `EXPORT_DATA` | ✅ | ❌ | ❌ | ❌ |

### 5.5 Client-Side Permission Checking

The `useAuth()` hook provides computed boolean flags:

```typescript
interface AuthPermissions {
  canManageUsers: boolean        // MANAGE_USERS
  canManageClients: boolean      // MANAGE_CLIENTS
  canManageSites: boolean        // MANAGE_SITES
  canManageCategories: boolean   // MANAGE_CATEGORIES
  canViewAuditLogs: boolean      // VIEW_AUDIT_LOGS
  canApproveExpenses: boolean    // ACCOUNTANT_APPROVE_EXPENSE || ADMIN_APPROVE_EXPENSE
  canApproveMIRs: boolean        // STOCK_MANAGER_APPROVE_MIR || ADMIN_APPROVE_MIR
  canManageInventory: boolean    // ORDER_MIR || RECEIVE_MIR
  canExportData: boolean         // EXPORT_DATA
  canViewAllExpenses: boolean    // VIEW_ALL_EXPENSES
  canViewAllMirs: boolean        // VIEW_ALL_MIRS
}
```

These permissions control:
- **Navigation visibility**: Admin-only items (Clients, Sites, Categories, Users, Audit Logs) are hidden for non-admin users
- **Action buttons**: Approve/Reject/Return/Mark Paid buttons only shown to users with relevant permissions
- **Tab access**: Certain tabs (Salaries) hidden for non-admin/accountant roles
- **Data filtering**: `VIEW_ALL_EXPENSES` vs `VIEW_OWN_EXPENSES` affects API queries

---

## 6. User Roles & Demo Accounts

### Demo Accounts

| Email | Password | Role | Employee Code |
|---|---|---|---|
| `admin@demo.com` | `admin123` | ADMIN | — |
| `accountant@demo.com` | `accountant123` | ACCOUNTANT | — |
| `stock@demo.com` | `stock123` | STOCK_MANAGER | — |
| `user@demo.com` | `user123` | USER | — |
| `user2@demo.com` | `user123` | USER | — |

### Role Color Coding (UI)

| Role | Badge Class | Label |
|---|---|---|
| ADMIN | `bg-red-100 text-red-800` | Admin |
| ACCOUNTANT | `bg-cyan-100 text-cyan-800` | Accountant |
| STOCK_MANAGER | `bg-emerald-100 text-emerald-800` | Stock Mgr |
| USER | `bg-stone-100 text-stone-800` | User |

### Login Page Demo Credential Buttons

The login page displays 4 clickable demo credential cards (2×2 grid) that auto-fill the form:
- Admin (red badge)
- Accountant (cyan badge)
- Stock Manager (emerald badge)
- User (amber badge)

---

## 7. Features (DETAILED)

### 7.1 Dashboard

**Access**: All authenticated users  
**Route**: Tab `dashboard`

**Role-Specific Behavior:**
- **Admin/Accountant**: Full stats (all expenses, all MIRs), user balance table, workflow diagrams, charts
- **Stock Manager**: Expense stats (own only), MIR stats (all), advance stats
- **User**: Simplified view with own expenses, pending returns, pending approvals

**Components:**
1. **Global Filters**: User selector, Client selector, Site selector, Month picker
2. **Stat Cards** (4):
   - This Month Expenses (total ₹)
   - Pending Expenses (count)
   - Accountant Approved (count)
   - Paid Expenses (total ₹)
3. **Material Request Stats** (4 cards):
   - Pending MRs
   - Stock Mgr Approved
   - Admin Approved MRs
   - This Month MRs
4. **Advance Stats** (3 cards):
   - Total Advances
   - Pending Advances
   - Net Balance (Advances − Expenses per user)
5. **User Balance Table**: Shows each user's total advances, total expenses, and net balance. Filterable by client, site, month, user.
6. **Monthly Late Submissions Chart**: Bar chart showing late submissions per month
7. **Workflow Diagrams**: Visual flowcharts for:
   - Expense: User → Accountant → Admin → Paid
   - MIR: User → Stock Manager → Admin → Ordered → Received
   - Advance: User → Accountant → Paid
8. **Monthly Expense Report by Category**: Bar chart + Pie chart showing category-wise breakdown
9. **Recent Expenses Table**: Latest 5 expenses
10. **Recent MRs Table**: Latest 5 requisitions

**API Endpoints:**
- `GET /api/dashboard` — Main stats (with `view`, `clientId`, `siteId`, `month`, `userId` params)
- `GET /api/dashboard/expense-stats` — Category-wise expense stats
- `GET /api/dashboard/late-submissions` — Monthly late submission chart data
- `GET /api/dashboard/reports` — Monthly/quarterly/yearly reports
- `GET /api/dashboard/user-balances` — User advance/expense balances
- `GET /api/dashboard/hr-stats` — HR statistics (employees, attendance, salaries, leaves)

### 7.2 Expenses Management

**Access**: All authenticated users (filtered by role)  
**Route**: Tab `expenses`

**Fields:**
- Site (required, dropdown filtered by client)
- Category (required, dropdown)
- Amount (required, ₹)
- Description (required, text)
- Expense Date (required, date picker)
- Seller Name (optional, text)
- Invoice Number (optional, text)
- Payment Method (default: CASH; CASH/UPI/CREDIT/OFFICE)
- Notes (optional, textarea)
- Receipt Upload (optional, file upload)

**Approval Workflow:**
```
PENDING → ACCOUNTANT_APPROVED → ADMIN_APPROVED → PAID
    ↓              ↓                   ↓
REJECTED      REJECTED           REJECTED
RETURNED      RETURNED           RETURNED
```

**Actions by Role:**
| Action | ADMIN | ACCOUNTANT | STOCK_MGR | USER |
|---|---|---|---|---|
| Submit | ✅ | ✅ | ✅ | ✅ |
| View All | ✅ | ✅ | ❌ | ❌ |
| View Own | ✅ | ✅ | ✅ | ✅ |
| Approve (Accountant) | ✅ | ✅ | ❌ | ❌ |
| Approve (Admin) | ✅ | ❌ | ❌ | ❌ |
| Reject | ✅ | ✅ | ❌ | ❌ |
| Return | ✅ | ✅ | ❌ | ❌ |
| Mark Paid | ✅ | ✅ | ❌ | ❌ |
| Resubmit (own returned) | ✅ | ✅ | ✅ | ✅ |
| Delete (own, PENDING only) | ✅ | ✅ | ✅ | ✅ |
| Edit (own, PENDING only) | ✅ | ✅ | ✅ | ✅ |

**Features:**
- Pagination (default 20 per page)
- Sorting by: createdAt, expenseDate, amount, status, updatedAt
- Filtering by: status, client, site, category, payment method, date range, amount range, late only, search text
- Search across: description, sellerName, invoiceNumber, user name
- **Bulk Actions**: Select multiple → Approve / Reject / Mark Paid
- **Bulk Upload**: Upload xlsx/xls/csv (max 500 rows, template download)
- **Export**: CSV, Excel, PDF
- **Late Submission Detection**: >3 days between expenseDate and submissionDate → flagged with `isLateSubmission: true`
- **Duplicate Detection Warning**: Checks for same site + amount match before submit
- **Comments**: Each expense has a comment thread
- **Receipt Viewer**: Opens base64 images/PDFs in dialog

### 7.3 Advances Management

**Access**: All authenticated users  
**Route**: Tab `advances`

**Fields:**
- Site (required)
- Amount (required, ₹)
- Purpose (required)
- Notes (optional)

**Approval Workflow:**
```
PENDING → APPROVED (Accountant) → PAID (auto-marked)
    ↓              ↓
REJECTED      REJECTED
RETURNED      RETURNED
```

> **Note**: In the simplified advance flow, accountant approval auto-marks as PAID. Admin approval step is skipped.

**Features:**
- CRUD with filters (status, user, site, date range, client, month)
- Bulk upload from xlsx/xls/csv
- Export to CSV, Excel, PDF
- Comments on advances
- Role-based filtering (admin/accountant see all; users see own only)

### 7.4 Material Requisitions (MIR)

**Access**: All authenticated users  
**Route**: Tab `requisitions`

**Fields:**
- Site (required)
- Title (required)
- Description (optional)
- Required Date (required)
- Priority (default: MEDIUM)
- Notes (optional)
- Attachment Upload (optional)
- **BOQ Items** (array):
  - Item Name (required)
  - Description (optional)
  - Quantity (required, Float)
  - Unit (required, e.g., "bags", "pieces", "meters")
  - Unit Price (required, ₹)
  - Total Price (auto-calculated: quantity × unitPrice)
  - Category (optional)
  - Notes (optional)

**Approval Workflow:**
```
PENDING → STOCK_MANAGER_APPROVED → ADMIN_APPROVED → ORDERED → RECEIVED
    ↓              ↓                     ↓
REJECTED      REJECTED              REJECTED
RETURNED      RETURNED              RETURNED
```

**Actions by Role:**
| Action | ADMIN | ACCOUNTANT | STOCK_MGR | USER |
|---|---|---|---|---|
| Submit | ✅ | ✅ | ✅ | ✅ |
| View All | ✅ | ❌ | ✅ | ❌ |
| View Own | ✅ | ✅ | ✅ | ✅ |
| Approve (Stock Mgr) | ✅ | ❌ | ✅ | ❌ |
| Approve (Admin) | ✅ | ❌ | ❌ | ❌ |
| Reject | ✅ | ❌ | ✅ | ❌ |
| Return | ✅ | ❌ | ✅ | ❌ |
| Mark Ordered | ✅ | ❌ | ✅ | ❌ |
| Mark Received | ✅ | ❌ | ✅ | ❌ |
| Resubmit (own returned) | ✅ | ✅ | ✅ | ✅ |

**Features:**
- Pagination, sorting, filtering
- BOQ items editor (add/remove rows inline)
- Total amount auto-calculated from BOQ items
- Attachment upload (base64)
- Bulk actions (approve/reject multiple)
- Export

### 7.5 BOQ (Bill of Quantities)

**Access**: All authenticated users  
**Route**: Tab `boq`

**Features:**
- Consolidated read-only view of all BOQ items across all requisitions
- Filter by: site, category, status
- Shows: item name, quantity, unit, unit price, total price, requisition title, site name, status
- No create/edit — BOQ items are managed through requisitions

### 7.6 Reports

**Access**: All authenticated users  
**Route**: Tab `reports`

**Features:**
- Time period selection: Monthly / Quarterly / Yearly
- Category breakdown with bar chart
- Site breakdown with bar chart
- Pie chart for category distribution
- Summary statistics
- Export capabilities

**API**: `GET /api/dashboard/reports?period=monthly&month=2025-01`

### 7.7 Client Management

**Access**: ADMIN only  
**Route**: Tab `clients`

**CRUD Operations:**
- Create client (name required, description optional)
- Edit client
- Delete client (FK protection — cannot delete if sites exist)
- List all clients with toggle for active/inactive

**Fields:** name (required), description (optional), isActive

### 7.8 Site Management

**Access**: ADMIN only  
**Route**: Tab `sites`

**CRUD Operations:**
- Create site (name, client required; location, description, budget optional)
- Edit site
- Delete site (FK protection)
- Budget tracking with visual progress bars (budget vs total expenses)

**Fields:** name, clientId (FK), location, description, budget (₹), isActive

### 7.9 Category Management

**Access**: ADMIN only  
**Route**: Tab `categories`

**CRUD Operations:**
- Create category (name, type required; description optional)
- Edit category
- Delete category

**Fields:** name (required), type (EXPENSE/REQUISITION/BOTH), description (optional), isActive

### 7.10 User Management

**Access**: ADMIN only  
**Route**: Tab `users`

**CRUD Operations:**
- Create user (email, name, password, role required)
- Edit user (name, role, isActive; password reset optional)
- Delete user
- No self-registration — all accounts created by admin

**Fields:** email (unique, lowercase), password (SHA-256 hashed), name, role, isActive

### 7.11 HR & Employee Management

**Access**: Role-dependent  
**Route**: Tab `employees`

**4 Sub-tabs:**

#### 7.11.1 Employees Tab
- List of employees with search, designation filter, department filter
- Stats cards: Total Employees, Active, This Month Joined, Departments count
- **Add Employee**: Links to existing user account; auto-generates employee code (SSE-001 format)
- **Edit Employee**: All fields editable by admin
- **View Employee**: Read-only detail view with latest salary info
- **Delete Employee**: Soft delete (sets isActive=false)
- Permission: ADMIN creates/edits/deletes; ACCOUNTANT views; others view own only

**Employee Fields:** userId, employeeCode (auto), designation, department, phone, address, joiningDate, baseSalary, bankAccount, bankName, bankIfsc, panNumber, aadhaarNumber

#### 7.11.2 Attendance Tab
- Date picker to select attendance date
- Status filter dropdown
- Table showing all employees with status dropdown per row
- **Bulk Mark All Present**: Sets all employees to PRESENT for selected date
- **Save Attendance**: Upserts attendance records (prevents duplicates via unique constraint)
- Permission: ADMIN/ACCOUNTANT full access; others view own only

**Attendance Fields:** employeeId, date, checkIn, checkOut, status, hoursWorked, overtimeHours, notes

#### 7.11.3 Leaves Tab
- Status filter buttons (All, Pending, Approved, Rejected, Cancelled)
- Leave request cards with approve/reject/cancel actions
- **Apply Leave**: Dialog with leave type, start/end dates, reason, total days auto-calculated
- Stats cards: Pending Leaves, Approved This Month, Total Leave Days
- Permission: ADMIN/ACCOUNTANT can approve/reject; users can apply and cancel own pending leaves

**Leave Fields:** employeeId, type (CASUAL/SICK/EARNED/HALF_DAY), startDate, endDate, totalDays, reason, status, approvedById, approvedAt, rejectionReason

#### 7.11.4 Salaries Tab (ADMIN/ACCOUNTANT only)
- Month selector (YYYY-MM format)
- **Generate Salaries**: Creates salary records for all active employees for selected month using their baseSalary
- Salary breakdown columns: Base, HRA, DA, TA, Bonus, Deductions, PF, TDS, Advance Deduction, Net Salary
- **Mark as Paid**: Sets status to PAID with paidDate
- **Edit Salary**: All components editable (except paid records)
- Stats cards: Total Disbursed, Pending Payment

**Salary Fields:** employeeId, month, baseSalary, hra, da, ta, bonus, deductions, pf, tds, advanceDeduction, netSalary (auto), paidDate, status, paymentMethod, notes

**Net Salary Formula:**
```
netSalary = baseSalary + hra + da + ta + bonus - deductions - pf - tds - advanceDeduction
```

### 7.12 Audit Logs

**Access**: ADMIN only  
**Route**: Tab `audit-logs`

**Features:**
- Paginated list of all audit log entries
- Filter by: user, action type, entity type
- Shows: timestamp, user name, action, entity type, entity ID, old/new values (expandable), IP address
- Read-only — no create/edit/delete

**Audit Action Types (examples):**
- `CREATE_EXPENSE`, `UPDATE_EXPENSE`, `DELETE_EXPENSE`
- `APPROVE_EXPENSE_ACCOUNTANT`, `APPROVE_EXPENSE_ADMIN`, `REJECT_EXPENSE`, `RETURN_EXPENSE`, `MARK_PAID_EXPENSE`
- `CREATE_REQUISITION`, `APPROVE_MIR_STOCK_MANAGER`, `APPROVE_MIR_ADMIN`, `ORDER_MIR`, `RECEIVE_MIR`
- `CREATE_ADVANCE`, `APPROVE_ADVANCE_ACCOUNTANT`, `MARK_PAID_ADVANCE`
- `CREATE_USER`, `UPDATE_USER`, `DELETE_USER`
- `BULK_UPLOAD_EXPENSE`, `BULK_UPLOAD_ADVANCE`
- `CREATE_EMPLOYEE`, `UPDATE_EMPLOYEE`
- `GENERATE_SALARIES`, `MARK_SALARY_PAID`
- `MARK_ATTENDANCE`, `BULK_MARK_ATTENDANCE`
- `CREATE_LEAVE`, `APPROVE_LEAVE`, `REJECT_LEAVE`

### 7.13 In-App Notifications

**Component**: `NotificationBell` in header  
**Access**: All authenticated users

**Behavior:**
- Bell icon in header with red badge showing count
- Count fetched from API on mount and when user/role changes
- Dropdown shows notification items:
  - Pending expenses (own, for users)
  - Returned expenses (own, for users)
  - Pending advances (for accountant/admin)
  - Pending approvals (for accountant/admin)
- Max display: "99+" for large counts
- Not real-time WebSocket — polled on mount

**Notification Counts:**
```typescript
{
  pendingExpenses: number,    // User's own pending expenses
  returnedExpenses: number,   // User's own returned expenses
  pendingAdvances: number,    // Pending advance count
  pendingApprovals: number    // Pending expenses + advances (admin/accountant only)
}
```

---

## 8. API Routes (COMPLETE LIST)

### Authentication

| Method | Path | Description | Auth | Access |
|---|---|---|---|---|
| POST | `/api/auth/login` | Login with email + password | No | Public |
| POST | `/api/auth/logout` | Clear auth token cookie | Yes | Any authenticated |
| GET | `/api/auth/me` | Get current user + permissions | Yes | Any authenticated |
| POST | `/api/auth/change-password` | Change own password | Yes | Any authenticated |

**Login Response:**
```json
{
  "user": { "id": "...", "email": "...", "name": "...", "role": "ADMIN" },
  "permissions": ["VIEW_ALL_EXPENSES", "MANAGE_USERS", ...]
}
```

### Users

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/api/users` | List all users (with search) | ADMIN |
| GET | `/api/users/:id` | Get single user | ADMIN |
| POST | `/api/users` | Create user | ADMIN |
| PUT | `/api/users/:id` | Update user | ADMIN |
| DELETE | `/api/users/:id` | Delete user | ADMIN |

### Clients

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/api/clients` | List all clients | ADMIN |
| GET | `/api/clients/:id` | Get single client | ADMIN |
| POST | `/api/clients` | Create client | ADMIN |
| PUT | `/api/clients/:id` | Update client | ADMIN |
| DELETE | `/api/clients/:id` | Delete client (FK protected) | ADMIN |

### Sites

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/api/sites` | List sites (optional `clientId` filter) | ADMIN |
| GET | `/api/sites/:id` | Get single site with expense total | ADMIN |
| POST | `/api/sites` | Create site | ADMIN |
| PUT | `/api/sites/:id` | Update site | ADMIN |
| DELETE | `/api/sites/:id` | Delete site (FK protected) | ADMIN |

### Categories

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/api/categories` | List categories (optional `type` filter) | Any |
| POST | `/api/categories` | Create category | ADMIN |
| PUT | `/api/categories/:id` | Update category | ADMIN |
| DELETE | `/api/categories/:id` | Delete category | ADMIN |

### Expenses

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/api/expenses` | List with pagination, sorting, filtering | Role-filtered |
| POST | `/api/expenses` | Create expense | SUBMIT_EXPENSE |
| GET | `/api/expenses/:id` | Get single expense | Owner or VIEW_ALL |
| PUT | `/api/expenses/:id` | Update expense (PENDING/RETURNED only) | Owner |
| DELETE | `/api/expenses/:id` | Delete expense (PENDING only) | Owner |
| POST | `/api/expenses/:id/approve-accountant` | Accountant approves | ACCOUNTANT_APPROVE_EXPENSE |
| POST | `/api/expenses/:id/approve-admin` | Admin approves | ADMIN_APPROVE_EXPENSE |
| POST | `/api/expenses/:id/reject` | Reject with reason | ACCOUNTANT/ADMIN |
| POST | `/api/expenses/:id/return` | Return with reason | ACCOUNTANT/ADMIN |
| POST | `/api/expenses/:id/mark-paid` | Mark as paid | MARK_EXPENSE_PAID |
| POST | `/api/expenses/:id/resubmit` | Resubmit returned expense | Owner |
| POST | `/api/expenses/bulk-action` | Bulk approve/reject/mark-paid | Per action |
| POST | `/api/expenses/bulk-upload` | Upload xlsx/xls/csv (max 500 rows) | SUBMIT_EXPENSE |
| GET | `/api/expenses/bulk-upload/template` | Download xlsx template | SUBMIT_EXPENSE |

**GET /api/expenses Query Parameters:**
| Parameter | Type | Description |
|---|---|---|
| `page` | int | Page number (default: 1) |
| `pageSize` | int | Items per page (default: 20) |
| `status` | string | Comma-separated statuses |
| `clientId` | string | Filter by client |
| `siteIds` | string | Comma-separated site IDs |
| `categoryIds` | string | Comma-separated category IDs |
| `paymentMethods` | string | Comma-separated payment methods |
| `dateFrom` | string | Start date (ISO) |
| `dateTo` | string | End date (ISO) |
| `amountFrom` | float | Min amount |
| `amountTo` | float | Max amount |
| `lateOnly` | boolean | Only late submissions |
| `search` | string | Search in description, seller, invoice, user name |
| `sortBy` | string | createdAt, expenseDate, amount, status, updatedAt |
| `sortOrder` | string | asc or desc |

**POST /api/expenses Request Body:**
```json
{
  "siteId": "string (required)",
  "categoryId": "string (required)",
  "amount": "number (required)",
  "description": "string (required)",
  "expenseDate": "string (ISO date, required)",
  "sellerName": "string (optional)",
  "invoiceNumber": "string (optional)",
  "paymentMethod": "CASH|UPI|CREDIT|OFFICE (default: CASH)",
  "receiptUrl": "string (base64 data URI, optional)",
  "receiptFileName": "string (optional)",
  "notes": "string (optional)"
}
```

### Advances

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/api/advances` | List with pagination, sorting, filtering | Role-filtered |
| POST | `/api/advances` | Create advance | Any authenticated |
| GET | `/api/advances/:id` | Get single advance | Owner or VIEW_ALL |
| PUT | `/api/advances/:id` | Update advance (PENDING/RETURNED) | Owner |
| DELETE | `/api/advances/:id` | Delete advance (PENDING) | Owner |
| POST | `/api/advances/:id/approve-accountant` | Accountant approves (auto-pays) | ACCOUNTANT/ADMIN |
| POST | `/api/advances/:id/approve-admin` | Admin approves | ADMIN |
| POST | `/api/advances/:id/reject` | Reject with reason | ACCOUNTANT/ADMIN |
| POST | `/api/advances/:id/return` | Return with reason | ACCOUNTANT/ADMIN |
| POST | `/api/advances/:id/mark-paid` | Mark as paid | ADMIN |
| POST | `/api/advances/bulk-upload` | Upload xlsx/xls/csv | Any authenticated |
| GET | `/api/advances/bulk-upload/template` | Download template | Any authenticated |

### Requisitions

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/api/requisitions` | List with pagination, sorting, filtering | Role-filtered |
| POST | `/api/requisitions` | Create requisition with BOQ items | SUBMIT_MIR |
| GET | `/api/requisitions/:id` | Get single with BOQ items | Owner or VIEW_ALL |
| PUT | `/api/requisitions/:id` | Update (PENDING/RETURNED) | Owner |
| DELETE | `/api/requisitions/:id` | Delete (PENDING) | Owner |
| POST | `/api/requisitions/:id/approve-stock-manager` | Stock manager approves | STOCK_MANAGER/ADMIN |
| POST | `/api/requisitions/:id/approve-admin` | Admin approves | ADMIN |
| POST | `/api/requisitions/:id/reject` | Reject with reason | STOCK_MANAGER/ADMIN |
| POST | `/api/requisitions/:id/return` | Return with reason | STOCK_MANAGER/ADMIN |
| POST | `/api/requisitions/:id/order` | Mark as ordered | STOCK_MANAGER/ADMIN |
| POST | `/api/requisitions/:id/receive` | Mark as received | STOCK_MANAGER/ADMIN |
| POST | `/api/requisitions/:id/resubmit` | Resubmit returned | Owner |
| POST | `/api/requisitions/bulk-action` | Bulk approve/reject | Per action |

### BOQ

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/api/boq` | List all BOQ items across requisitions | Any authenticated |

**Query Parameters:** `siteId`, `category`, `status`

### Employees

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/api/employees` | List with filters (search, designation, department) | Role-filtered |
| POST | `/api/employees` | Create employee (auto-generates SSE-XXX code) | ADMIN |
| GET | `/api/employees/:id` | Get single with latest salary + counts | Role-filtered |
| PUT | `/api/employees/:id` | Update employee | ADMIN |
| DELETE | `/api/employees/:id` | Soft delete (isActive=false) | ADMIN |

### Salaries

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/api/salaries` | List with filters (month, status, employee) | ADMIN/ACCOUNTANT |
| POST | `/api/salaries` | Create salary record (auto-calculates netSalary) | ADMIN/ACCOUNTANT |
| GET | `/api/salaries/:id` | Get single salary | ADMIN/ACCOUNTANT |
| PUT | `/api/salaries/:id` | Update salary (auto-recalculates netSalary) | ADMIN/ACCOUNTANT |
| POST | `/api/salaries/:id/mark-paid` | Mark as paid (ADMIN only) | ADMIN |

### Attendance

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/api/attendance` | List with filters (date, employee, status) | ADMIN/ACCOUNTANT |
| POST | `/api/attendance` | Create/upsert single or multiple records | ADMIN/ACCOUNTANT |
| POST | `/api/attendance/bulk-mark` | Bulk mark attendance for one date | ADMIN/ACCOUNTANT |

**POST /api/attendance/bulk-mark Body:**
```json
{
  "date": "2025-01-15",
  "records": [
    { "employeeId": "...", "status": "PRESENT", "checkIn": "...", "checkOut": "..." },
    { "employeeId": "...", "status": "ABSENT" }
  ]
}
```

### Leaves

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/api/leaves` | List with filters (status, employee, date range) | Role-filtered |
| POST | `/api/leaves` | Create leave (auto-calculates totalDays) | Any authenticated |
| GET | `/api/leaves/:id` | Get single leave | Role-filtered |
| PUT | `/api/leaves/:id` | Update (PENDING by owner only) | Owner |
| POST | `/api/leaves/:id/approve` | Approve leave | ADMIN/ACCOUNTANT |
| POST | `/api/leaves/:id/reject` | Reject with reason | ADMIN/ACCOUNTANT |
| POST | `/api/leaves/:id/cancel` | Cancel (owner or ADMIN, PENDING only) | Owner/ADMIN |

### Dashboard

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/api/dashboard` | Main dashboard stats | Any authenticated |
| GET | `/api/dashboard/expense-stats` | Category-wise expense stats | Any authenticated |
| GET | `/api/dashboard/late-submissions` | Monthly late submission data | Any authenticated |
| GET | `/api/dashboard/reports` | Monthly/quarterly/yearly reports | Any authenticated |
| GET | `/api/dashboard/user-balances` | User advance vs expense balances | ADMIN/ACCOUNTANT |
| GET | `/api/dashboard/hr-stats` | HR statistics | Any authenticated |

### Comments

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/api/comments` | List comments for entity | Any authenticated |
| POST | `/api/comments` | Add comment | Any authenticated |

**Query Parameters:** `entityType` (EXPENSE/ADVANCE/REQUISITION), `entityId`

### Audit Logs

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/api/audit-logs` | List with pagination | ADMIN |

### Balances

| Method | Path | Description | Access |
|---|---|---|---|
| GET | `/api/balances` | Get user balance summary | ADMIN/ACCOUNTANT |

### Seed

| Method | Path | Description | Access |
|---|---|---|---|
| POST | `/api/seed` | Seed database with demo data | No auth (use with caution) |

**Request Body:** `{ "force": true }` to reseed even if data exists.

---

## 9. Multi-Language Support

### Implementation

**File**: `src/lib/i18n.ts`  
**Type**: `Language = 'en' | 'hi'`  
**Hook**: `useLanguage()` from `src/hooks/use-language.tsx`

### Translation Structure

```typescript
export const translations: Record<Language, Record<string, string>> = {
  en: { 'nav.dashboard': 'Dashboard', ... },
  hi: { 'nav.dashboard': 'डैशबोर्ड', ... }
}

export function t(key: string, lang: Language = 'en'): string {
  return translations[lang]?.[key] || translations.en[key] || key
}
```

### Translation Key Categories

| Prefix | Category | Count (approx) |
|---|---|---|
| `nav.*` | Navigation | 12 |
| `header.*` | Header | 2 |
| `dashboard.*` | Dashboard | 16 |
| `expenses.*` | Expenses page | 18 |
| `col.*` | Table columns | 16 |
| `form.*` | Form fields | 14 |
| `btn.*` | Buttons | 9 |
| `status.*` | Status labels | 5 |
| `toast.*` | Toast messages | 4 |
| `file.*` | File viewer | 2 |
| `filter.*` | Filters | 6 |
| `requisitions.*` | Requisitions | 6 |
| `hr.*` | HR module | 62 |
| `misc.*` | Miscellaneous | 4 |

**Total**: ~176 translation keys per language

### Usage

```tsx
import { useLanguage } from '@/hooks/use-language'

function MyComponent() {
  const { t, language, setLanguage } = useLanguage()
  return <h1>{t('nav.dashboard')}</h1>
}
```

### Language Persistence

Language preference stored in `localStorage` under key `preferred-language`. Falls back to English.

### Adding a New Translation

1. Add the key to both `en` and `hi` objects in `src/lib/i18n.ts`
2. Use the `t('your.new.key')` function in components

---

## 10. File Upload & Storage

### Storage Strategy

All file uploads (receipts, attachments) are stored as **base64 data URIs** directly in the database. This is necessary for Vercel serverless deployment which has a read-only filesystem.

### Upload Flow

1. User selects a file (drag & drop or click)
2. File read as base64 using `FileReader.readAsDataURL()`
3. Base64 data URI string sent to API in JSON body as `receiptUrl` or `attachmentUrl`
4. Stored directly in the database column (TEXT type)

### Constraints

- **Max file size**: 5MB
- **Supported formats**: Images (JPEG, PNG, GIF, WebP), PDFs
- **Data URI format**: `data:image/jpeg;base64,/9j/4AAQ...`

### Bulk Upload

For bulk expense/advance uploads via xlsx/xls/csv:
- Files sent as `FormData` (multipart)
- Parsed server-side using `xlsx` library
- Max 500 rows per upload
- Template download available

### Print Support

Custom print CSS in `globals.css`:
- Hides header, footer, sidebar, nav
- Shows only `#print-area`
- Clean A4 formatting with proper margins
- Removes background colors and shadows

---

## 11. Export Capabilities

### Implementation

**File**: `src/lib/export.ts` — All exports are **client-side** using already-loaded page data.

### CSV Export

```typescript
exportToCSV<T>(data, columns, filename)
```
- UTF-8 BOM prefix for Excel compatibility
- Proper escaping for commas, newlines, quotes
- Downloaded as `.csv`

### Excel Export

```typescript
exportToXLS<T>(data, columns, filename)
```
- Uses `xlsx` library (SheetJS)
- Auto-sized column widths (max 50 chars)
- Downloaded as `.xlsx`

### PDF Export

```typescript
exportToPDF<T>(data, columns, filename, title?)
```
- Uses `jsPDF` + `jspdf-autotable`
- Landscape A4 orientation
- Title with generation timestamp and record count on every page
- Stone-900 header row with white text
- Alternating row colors
- Downloaded as `.pdf`

### Column Configuration Pattern

```typescript
const columns = [
  { key: 'amount', label: 'Amount (₹)', format: (val) => `₹${val.toLocaleString()}` },
  { key: 'status', label: 'Status' },
  { key: 'expenseDate', label: 'Date', format: (val) => new Date(val).toLocaleDateString() },
]
```

---

## 12. Deployment Guide

### Vercel Deployment

#### 1. Database Setup (Turso)

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create database
turso db create sse-expenses

# Get connection URL
turso db show sse-expenses --url
# Output: libsql://sse-expenses-xyz.turso.io

# Create auth token
turso db tokens create sse-expenses
# Output: abc123...
```

#### 2. Push Schema to Turso

Prisma's `db push` does not directly support `libsql://` URLs when `provider = "sqlite"`.
Use the following approach to generate SQL and push it:

```bash
# Step 1: Generate SQL from your Prisma schema
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > schema.sql

# Step 2: Execute SQL against Turso using @libsql/client
node -e "
const { createClient } = require('@libsql/client');
const fs = require('fs');
const client = createClient({
  url: 'libsql://expense-manager-animeshjainsse.aws-ap-south-1.turso.io',
  authToken: 'your-turso-auth-token',
});
const sql = fs.readFileSync('schema.sql', 'utf-8');
const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
Promise.all(stmts.map(s => client.execute(s))).then(() => {
  console.log('Schema pushed! Tables:', stmts.length);
});
"

# Step 3: Seed data (after deploying to Vercel)
curl -X POST https://your-app.vercel.app/api/seed
```

**IMPORTANT:** After any schema changes, repeat Steps 1-2 to update the Turso database.

#### 3. Environment Variables (Vercel)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | `libsql://[host]` (e.g., `libsql://expense-manager-org.turso.io`) |
| `DATABASE_AUTH_TOKEN` | Yes | Your Turso auth token (generated via `turso db tokens create`) |

#### 4. Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

#### 5. Custom Domain

1. In Vercel dashboard → Settings → Domains
2. Add `sselectricals.in`
3. Configure DNS records as instructed by Vercel

### Next.js Configuration

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.space.z.ai"],
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: false,
  serverExternalPackages: ['@libsql/client'],
  // For Vercel: output is default (NOT standalone)
  // For Docker/custom server: uncomment output: "standalone"
}
```

### Database Client Auto-Detection

```typescript
// src/lib/db.ts
function createDb(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL || ''
  const authToken = process.env.DATABASE_AUTH_TOKEN || ''
  if (dbUrl.startsWith('libsql://')) {
    // Turso/libSQL for production
    const { PrismaLibSQL } = require('@prisma/adapter-libsql')
    // IMPORTANT: Pass config object, NOT a pre-created client instance
    const adapter = new PrismaLibSQL({ url: dbUrl, authToken: authToken })
    return new PrismaClient({ adapter, log: ['error'] })
  }
  // Local SQLite for development
  return new PrismaClient({ log: ['error'] })
}
```

---

## 13. Business Rules

### Expense Rules
- **Late submission threshold**: 3 days. If `submissionDate - expenseDate > 3 days`, flagged as late.
- **Approval chain**: User → Accountant → Admin → Paid
- **Rejection reason**: Required when rejecting
- **Return reason**: Required when returning
- **Resubmission**: Only RETURNED expenses can be resubmitted (keeps same ID)
- **Editing**: Only PENDING and RETURNED expenses can be edited
- **Deleting**: Only PENDING expenses can be deleted
- **Duplicate check**: Warning shown if same site + same amount exists (not blocking)

### Advance Rules
- **Simplified flow**: Accountant approval auto-marks as PAID (no separate admin step)
- **Balance tracking**: Advance amounts tracked per user against expenses
- **Net balance**: Total Advances − Total Expenses

### MIR Rules
- **3-level workflow**: User → Stock Manager → Admin → Ordered → Received
- **Priority levels**: LOW, MEDIUM (default), HIGH, URGENT
- **BOQ items**: Each MIR has multiple BOQ items; total auto-calculated
- **Attachment**: Optional file upload supported

### General Rules
- **Currency**: Always INR (₹). No multi-currency support.
- **No GST/Tax calculation**: Amounts are entered as-is
- **No petty cash**: Not tracked
- **No vendor management**: No vendor database
- **No photo documentation**: Receipt uploads only
- **No Tally integration**: Standalone system
- **Single company**: No multi-tenant architecture
- **Budget tracking**: Informational only — no hard limits, no threshold warnings
- **FK protection**: Cannot delete a client if sites exist; cannot delete a site if expenses exist

---

## 14. Responsive Design

### Approach

Mobile-first with progressive enhancement.

### Breakpoints

| Breakpoint | Width | Layout |
|---|---|---|
| Default | < 640px | Mobile (single column) |
| `sm` | ≥ 640px | Small tablet |
| `md` | ≥ 768px | Tablet |
| `lg` | ≥ 1024px | Desktop (sidebar visible) |
| `xl` | ≥ 1280px | Large desktop |

### Sidebar Behavior

- **Desktop (lg+)**: Fixed 256px sidebar (`w-64`) on the left
- **Mobile/Tablet**: Hidden; accessible via hamburger menu → shadcn Sheet component (slides from left)

### Header

- Sticky top (`sticky top-0 z-30`)
- Height: `h-14` (56px)
- Contains: hamburger (mobile), page title, notification bell, language selector, logout button
- Padding: `px-4 lg:px-6`

### Touch Targets

- Minimum 44px touch targets for all interactive elements
- Button sizes: `sm` (32px), `default` (36px), `lg` (40px)

### Content Area

- Main content: `flex-1 overflow-y-auto p-4 lg:p-6`
- Max heights with scroll: `max-h-96 overflow-y-auto` for tables/lists
- Custom scrollbar styling via Tailwind

### Footer

- Border top, centered text
- "S.S. Electricals © 2025 — Powered by Z.ai"
- Sticks to bottom via flex layout (`mt-auto`)

---

## 15. Key Design Decisions

### Why SHA-256 instead of bcrypt?

- **Web Crypto API** is available globally in Bun, Node.js, and browser runtimes
- **No native bcrypt** in Vercel Edge Runtime / serverless functions
- **No external dependency** needed
- **Trade-off**: SHA-256 is faster (less secure against brute-force) but acceptable for an internal app with ~30 users behind authentication

### Why base64 for file storage?

- **Vercel serverless has no persistent filesystem** — can't write files to disk
- **Database is the only persistent storage** on Vercel
- **base64 data URIs** can be stored directly in TEXT columns
- **Trade-off**: ~33% larger storage size, but acceptable for receipts (typically <1MB)

### Why SQLite locally + Turso for production?

- **SQLite**: Zero-config local development, file-based, no external service needed
- **Turso (libSQL)**: SQLite-compatible serverless database, seamless migration
- **Prisma adapter pattern**: Same Prisma Client code works for both — auto-detected via `DATABASE_URL` prefix
- **Trade-off**: Different SQL features may behave slightly differently (edge cases rare)

### Why token-based auth (not NextAuth.js)?

- **Simple**: Cookie with random token, checked against database
- **Edge-compatible**: No OAuth providers, no JWT libraries needed
- **Admin creates accounts**: No self-registration, no social login
- **Trade-off**: No refresh token rotation, no rate limiting built-in

### Why single-page with lazy loading?

- **Reduces initial compilation**: Each page component is only compiled when first visited
- **Better UX**: Instant tab switching after initial load (no full-page navigation)
- **Memory efficient**: Only loaded tab's code is in memory
- **Trade-off**: All code ships in single bundle (but tree-shaking still works)

---

## 16. Seed Data

### Access

```bash
# Seed empty database
POST /api/seed

# Force reseed (deletes existing data)
POST /api/seed
Body: { "force": true }
```

### Seed Data Summary

| Entity | Count | Details |
|---|---|---|
| Users | 6 | All 4 roles represented |
| Clients | 3 | ABC Construction, XYZ Builders, Sunrise Developers |
| Sites | 6 | Across 3 clients, budgets ₹3M-₹15M |
| Categories | 8 | Mixed types (EXPENSE, REQUISITION, BOTH) |
| Expenses | 16+ | All statuses represented, some late submissions |
| Requisitions | 8 | All statuses represented, each with 2-4 BOQ items |
| BOQ Items | 27+ | Varied materials (cement, steel, electrical, plumbing, etc.) |

### Seed Clients

| Name | Sites |
|---|---|
| ABC Construction Co. | Downtown Tower Project, Harbor Bridge Renovation |
| XYZ Builders Ltd. | Riverside Apartments, Shopping Mall Phase 2 |
| Sunrise Developers | Tech Park Building A, Sunrise Villa Estate |

### Seed Categories

| Name | Type |
|---|---|
| Construction Materials | BOTH |
| Labor & Wages | EXPENSE |
| Equipment Rental | BOTH |
| Transportation | BOTH |
| Office Supplies | EXPENSE |
| Electrical & Plumbing | BOTH |
| Safety Equipment | BOTH |
| Permits & Licenses | EXPENSE |

### Seed Delete Order (for force reseed)

```
AuditLog → BOQItem → Expense → Requisition → Comment → Advance → Salary →
Attendance → Leave → Employee → Site → Category → Client → User
```

---

## 17. File Structure (COMPLETE)

```
/home/z/my-project/
├── next.config.ts                    # Next.js configuration
├── package.json                      # Dependencies and scripts
├── tsconfig.json                     # TypeScript configuration
├── tailwind.config.ts                # Tailwind CSS configuration
├── components.json                   # shadcn/ui configuration (new-york style)
├── postcss.config.mjs               # PostCSS configuration
├── eslint.config.mjs                 # ESLint configuration
├── Caddyfile                         # Caddy reverse proxy config
├── bun.lock                          # Bun lockfile
│
├── prisma/
│   └── schema.prisma                 # Database schema (15 models, 10 enums)
│
├── db/
│   └── custom.db                     # Local SQLite database file
│
├── public/
│   ├── logo.svg                      # App favicon/logo
│   ├── robots.txt                    # SEO robots file
│   └── uploads/                      # Legacy uploads folder (not used in Vercel)
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                # Root layout (Geist fonts, Providers, Toaster)
│   │   ├── page.tsx                  # Single route entry (SPA with lazy loading)
│   │   ├── globals.css               # Theme variables (light/dark), print styles
│   │   └── api/                      # All API route handlers
│   │       ├── auth/
│   │       │   ├── login/route.ts            # POST - Login
│   │       │   ├── logout/route.ts           # POST - Logout
│   │       │   ├── me/route.ts               # GET - Current user
│   │       │   └── change-password/route.ts  # POST - Change password
│   │       ├── users/
│   │       │   ├── route.ts                  # GET (list), POST (create)
│   │       │   └── [id]/route.ts             # GET, PUT, DELETE
│   │       ├── clients/
│   │       │   ├── route.ts                  # GET (list), POST (create)
│   │       │   └── [id]/route.ts             # GET, PUT, DELETE
│   │       ├── sites/
│   │       │   ├── route.ts                  # GET (list), POST (create)
│   │       │   └── [id]/route.ts             # GET, PUT, DELETE
│   │       ├── categories/
│   │       │   ├── route.ts                  # GET (list), POST (create)
│   │       │   └── [id]/route.ts             # PUT, DELETE
│   │       ├── expenses/
│   │       │   ├── route.ts                  # GET (list), POST (create)
│   │       │   ├── [id]/
│   │       │   │   ├── route.ts              # GET, PUT, DELETE
│   │       │   │   ├── approve-accountant/route.ts  # POST
│   │       │   │   ├── approve-admin/route.ts      # POST
│   │       │   │   ├── reject/route.ts             # POST
│   │       │   │   ├── return/route.ts              # POST
│   │       │   │   ├── mark-paid/route.ts          # POST
│   │       │   │   └── resubmit/route.ts           # POST
│   │       │   ├── bulk-action/route.ts        # POST - Bulk approve/reject
│   │       │   └── bulk-upload/
│   │       │       ├── route.ts              # POST - Upload file
│   │       │       └── template/route.ts      # GET - Download template
│   │       ├── advances/
│   │       │   ├── route.ts                  # GET (list), POST (create)
│   │       │   ├── [id]/
│   │       │   │   ├── route.ts              # GET, PUT, DELETE
│   │       │   │   ├── _helper.ts            # Shared helper functions
│   │       │   │   ├── approve-accountant/route.ts  # POST
│   │       │   │   ├── approve-admin/route.ts      # POST
│   │       │   │   ├── reject/route.ts             # POST
│   │       │   │   ├── return/route.ts              # POST
│   │       │   │   └── mark-paid/route.ts          # POST
│   │       │   └── bulk-upload/
│   │       │       ├── route.ts              # POST - Upload file
│   │       │       └── template/route.ts      # GET - Download template
│   │       ├── requisitions/
│   │       │   ├── route.ts                  # GET (list), POST (create)
│   │       │   ├── [id]/
│   │       │   │   ├── route.ts              # GET, PUT, DELETE
│   │       │   │   ├── approve-stock-manager/route.ts  # POST
│   │       │   │   ├── approve-admin/route.ts        # POST
│   │       │   │   ├── reject/route.ts               # POST
│   │       │   │   ├── return/route.ts               # POST
│   │       │   │   ├── order/route.ts                 # POST
│   │       │   │   ├── receive/route.ts               # POST
│   │       │   │   └── resubmit/route.ts            # POST
│   │       │   └── bulk-action/route.ts        # POST - Bulk actions
│   │       ├── boq/
│   │       │   └── route.ts                  # GET - List all BOQ items
│   │       ├── employees/
│   │       │   ├── route.ts                  # GET (list), POST (create)
│   │       │   └── [id]/route.ts             # GET, PUT, DELETE
│   │       ├── salaries/
│   │       │   ├── route.ts                  # GET (list), POST (create)
│   │       │   └── [id]/
│   │       │       ├── route.ts              # GET, PUT
│   │       │       └── mark-paid/route.ts    # POST
│   │       ├── attendance/
│   │       │   ├── route.ts                  # GET, POST (single/bulk)
│   │       │   └── bulk-mark/route.ts        # POST - Bulk mark by date
│   │       ├── leaves/
│   │       │   ├── route.ts                  # GET (list), POST (create)
│   │       │   └── [id]/
│   │       │       ├── route.ts              # GET, PUT
│   │       │       ├── approve/route.ts      # POST
│   │       │       ├── reject/route.ts       # POST
│   │       │       └── cancel/route.ts       # POST
│   │       ├── dashboard/
│   │       │   ├── route.ts                  # GET - Main stats
│   │       │   ├── expense-stats/route.ts    # GET - Category stats
│   │       │   ├── late-submissions/route.ts # GET - Late sub chart
│   │       │   ├── reports/route.ts          # GET - Reports
│   │       │   ├── user-balances/route.ts    # GET - User balances
│   │       │   └── hr-stats/route.ts         # GET - HR stats
│   │       ├── comments/
│   │       │   └── route.ts                  # GET, POST
│   │       ├── audit-logs/
│   │       │   └── route.ts                  # GET - List with pagination
│   │       ├── balances/
│   │       │   └── route.ts                  # GET - Balance summary
│   │       ├── seed/
│   │       │   └── route.ts                  # POST - Seed database
│   │       └── route.ts                      # GET - API health check
│   │
│   ├── components/
│   │   ├── providers.tsx                 # QueryClientProvider + LanguageProvider
│   │   ├── logo.tsx                      # SVG logo (S.S. monogram + lightning bolt)
│   │   ├── comment-thread.tsx           # Reusable comment component
│   │   ├── bulk-upload-dialog.tsx        # Reusable bulk upload dialog
│   │   ├── expense-manager/             # Page components (lazy-loaded)
│   │   │   ├── layout.tsx               # App shell (sidebar + header + footer)
│   │   │   ├── login-page.tsx           # Login form + demo credentials
│   │   │   ├── dashboard-page.tsx       # Dashboard with stats, charts, tables
│   │   │   ├── expenses-page.tsx        # Expense management with CRUD
│   │   │   ├── advances-page.tsx        # Advance management with CRUD
│   │   │   ├── requisitions-page.tsx    # MIR management with BOQ editor
│   │   │   ├── boq-page.tsx             # BOQ consolidated view
│   │   │   ├── reports-page.tsx         # Reports with charts
│   │   │   ├── clients-page.tsx         # Client CRUD (admin)
│   │   │   ├── sites-page.tsx           # Site CRUD with budget tracking
│   │   │   ├── categories-page.tsx      # Category CRUD (admin)
│   │   │   ├── users-page.tsx           # User CRUD (admin)
│   │   │   ├── employees-page.tsx       # HR module (4 tabs)
│   │   │   └── audit-logs-page.tsx      # Audit log viewer (admin)
│   │   └── ui/                          # shadcn/ui components (50+ files)
│   │       ├── accordion.tsx
│   │       ├── alert.tsx
│   │       ├── alert-dialog.tsx
│   │       ├── aspect-ratio.tsx
│   │       ├── avatar.tsx
│   │       ├── badge.tsx
│   │       ├── breadcrumb.tsx
│   │       ├── button.tsx
│   │       ├── calendar.tsx
│   │       ├── card.tsx
│   │       ├── carousel.tsx
│   │       ├── chart.tsx
│   │       ├── checkbox.tsx
│   │       ├── collapsible.tsx
│   │       ├── command.tsx
│   │       ├── context-menu.tsx
│   │       ├── dialog.tsx
│   │       ├── drawer.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── form.tsx
│   │       ├── hover-card.tsx
│   │       ├── input.tsx
│   │       ├── input-otp.tsx
│   │       ├── label.tsx
│   │       ├── menubar.tsx
│   │       ├── navigation-menu.tsx
│   │       ├── pagination.tsx
│   │       ├── popover.tsx
│   │       ├── progress.tsx
│   │       ├── radio-group.tsx
│   │       ├── resizable.tsx
│   │       ├── scroll-area.tsx
│   │       ├── select.tsx
│   │       ├── separator.tsx
│   │       ├── sheet.tsx
│   │       ├── sidebar.tsx
│   │       ├── skeleton.tsx
│   │       ├── slider.tsx
│   │       ├── sonner.tsx
│   │       ├── switch.tsx
│   │       ├── table.tsx
│   │       ├── tabs.tsx
│   │       ├── textarea.tsx
│   │       ├── toast.tsx
│   │       ├── toaster.tsx
│   │       ├── toggle.tsx
│   │       ├── toggle-group.tsx
│   │       ├── tooltip.tsx
│   │       └── ...
│   │
│   ├── hooks/
│   │   ├── use-auth.tsx          # AuthProvider context + useAuth hook
│   │   ├── use-language.tsx      # LanguageProvider context + useLanguage hook
│   │   ├── use-toast.ts          # Toast notification hook (shadcn)
│   │   └── use-mobile.ts         # Mobile breakpoint detection hook
│   │
│   └── lib/
│       ├── api.ts                # Frontend API client (class-based, all methods)
│       ├── auth.ts               # Backend auth: hashPassword, verifyPassword, getSession, checkPermission
│       ├── db.ts                 # Prisma client singleton (auto-detects Turso vs SQLite)
│       ├── i18n.ts               # Translation strings (en: ~176 keys, hi: ~176 keys)
│       ├── audit.ts              # createAuditLog(), formatAuditValues()
│       ├── export.ts             # exportToCSV(), exportToXLS(), exportToPDF()
│       └── utils.ts              # cn() utility (clsx + tailwind-merge)
│
├── scripts/
│   ├── seed.ts                   # Standalone seed script
│   ├── integration-test.ts       # Integration test runner
│   └── verify-api-contracts.ts   # API contract verification
│
├── examples/
│   └── websocket/                # WebSocket demo (not used in production)
│       ├── server.ts
│       └── frontend.tsx
│
├── worklog.md                    # Development work log
├── DEVELOPER_GUIDE.md            # THIS FILE
├── VERCEL_DEPLOYMENT_GUIDE.md    # Vercel deployment guide
└── BUG_LOG.md                    # Bug tracking log
```

---

## Appendix A: Common Code Patterns

### API Route Pattern

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog, formatAuditValues } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (!checkPermission(session.role, 'SOME_PERMISSION'))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    
    // ... business logic ...
    
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### Client API Call Pattern

```typescript
// In api.ts
async getExpenses(params?: Record<string, string>) {
  const query = params ? '?' + new URLSearchParams(params).toString() : ''
  const res = await this.request<{ expenses: any[]; pagination: any }>(`/api/expenses${query}`)
  return { data: res?.expenses || [], total: res?.pagination?.total || 0, ... }
}

// In component
const { data, isLoading } = useQuery({
  queryKey: ['expenses', filters],
  queryFn: () => api.getExpenses(filters),
})
```

### Lazy Page Component Pattern

```typescript
// Export as named export
export function ExpensesPage() {
  return <div>...</div>
}

// Import with lazy
const ExpensesPage = lazy(() => import('./expenses-page').then(m => ({ default: m.ExpensesPage })))

// Render with Suspense
<Suspense fallback={<PageLoader />}>
  <ExpensesPage />
</Suspense>
```

### Permission Check in Component

```tsx
const { permissions } = useAuth()

{permissions.canManageUsers && (
  <NavItem id="users" labelKey="nav.users" icon={<Users />} />
)}
```

---

## Appendix B: shadcn/ui Components Used

| Component | Usage |
|---|---|
| `Button` | All actions |
| `Card`, `CardContent`, `CardHeader`, `CardTitle`, `CardDescription` | Stat cards, content cards |
| `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter` | Modals for create/edit/view |
| `Input` | Text inputs |
| `Textarea` | Multi-line text |
| `Label` | Form labels |
| `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` | Dropdowns |
| `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` | Data tables |
| `Badge` | Status badges, role badges |
| `Separator` | Visual dividers |
| `Sheet`, `SheetContent`, `SheetTrigger` | Mobile sidebar |
| `ScrollArea` | Scrollable content |
| `Skeleton` | Loading placeholders |
| `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger` | Tab navigation |
| `Progress` | Budget progress bars |
| `DropdownMenu` | Notification bell, action menus |
| `Avatar`, `AvatarFallback` | User avatars in comments |
| `Popover` | Date picker trigger |
| `Checkbox` | Bulk selection |
| `Alert` | Warning/info messages |
| `Switch` | Toggle settings |
| `Tooltip` | Hover tooltips |
| `Calendar` | Date picker |
| `Pagination` | Pagination controls (via custom implementation) |
| `Chart` | Recharts wrapper (via shadcn chart component) |

---

*End of Developer Guide. This document should provide everything needed to rebuild this application from scratch.*
