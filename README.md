# SSE Expense Manager

A comprehensive expense management web application built with Next.js 16, TypeScript, Prisma, and shadcn/ui. Designed for organizations to manage **expenses**, **purchase requisitions (MIRs)**, and **cash advances** with role-based approval workflows.

## Features

- **Dashboard** with summary charts, stats, and recent activity
- **Expense Management** — Create, submit, approve/reject, print expense reports
- **Requisition Management** — Material/Item Requisitions with urgency levels
- **Cash Advance Management** — Request, track, and settle advances
- **User Management** — Admin panel with bulk CSV upload
- **Site & Client Management** — Admin-only organization of sites and clients
- **Category Management** — Admin-only expense category CRUD with bulk upload
- **Bulk Upload** — CSV bulk upload for expenses, requisitions, and advances (all users) + sites, clients, categories, and users (admin)
- **Print Templates** — Print-specific layouts for each entity type with SSE branding
- **Column Visibility** — Persisted column preferences for data tables
- **Role-Based Access Control** — ADMIN, MANAGER, STOCK_MANAGER, EMPLOYEE

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| Next.js 16 (App Router) | Framework |
| TypeScript 5 | Language |
| Tailwind CSS 4 | Styling |
| shadcn/ui | Component Library |
| Prisma (SQLite) | Database ORM |
| React Query | Server State |
| Zustand | Client State |
| Lucide Icons | Icons |
| date-fns | Date Formatting |
| Recharts | Charts |

## Getting Started

### Prerequisites
- [Bun](https://bun.sh/) (recommended) or Node.js 18+

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd sse-expense-manager

# Install dependencies
bun install

# Set up environment
cp .env.example .env

# Push database schema
bun run db:push

# (Optional) Seed with demo data
bun run prisma db seed

# Start development server
bun run dev
```

The app will be available at `http://localhost:3000`.

## Role Permissions

| Feature | ADMIN | MANAGER | STOCK_MANAGER | EMPLOYEE |
|---------|:-----:|:-------:|:-------------:|:--------:|
| View Dashboard | ✅ | ✅ | ✅ | ✅ |
| Create Expenses/Requisitions/Advances | ✅ | ✅ | ✅ | ✅ |
| Bulk Upload Expenses/Requisitions/Advances | ✅ | ✅ | ✅ | ✅ |
| Edit Own Draft Items | ✅ | ✅ | ✅ | ✅ |
| Edit Submitted Items | ✅ | ❌ | ✅ | ❌ |
| Approve/Reject/Send Back Expenses | ✅ | ✅ | ❌ | ❌ |
| Approve/Reject/Send Back Requisitions | ✅ | ❌ | ✅ | ❌ |
| Approve/Reject/Send Back Advances | ✅ | ✅ | ❌ | ❌ |
| Manage Users | ✅ | ❌ | ❌ | ❌ |
| Manage Sites/Clients/Categories | ✅ | ❌ | ❌ | ❌ |
| Bulk Upload Users/Sites/Clients/Categories | ✅ | ❌ | ❌ | ❌ |

## Bulk Upload CSV Formats

### Expenses
```
title,description,category_code,item_description,amount,item_date,site_code,client_code
```

### Requisitions
```
title,description,item_description,quantity,unit_price,urgency,item_code,site_code,client_code
```

### Advances
```
title,description,amount,purpose,expected_return_date,site_code,client_code
```

### Users
```
name,email,role,department,employeeId,phone
```

### Sites
```
name,code,address,city,state,pincode
```

### Clients
```
name,code,email,phone,address,city,state
```

### Categories
```
name,code
```

## Status Workflows

- **Expense**: `DRAFT` → `SUBMITTED` → `APPROVED` → `PAID` (or `REJECTED` / `SENT_BACK`)
- **Requisition**: `DRAFT` → `SUBMITTED` → `APPROVED` → `FULFILLED` (or `REJECTED` / `SENT_BACK`)
- **Advance**: `DRAFT` → `SUBMITTED` → `APPROVED` → `DISBURSED` → `SETTLED` (or `REJECTED` / `SENT_BACK`)

## Project Structure

```
src/
├── app/
│   ├── api/              # Backend API routes
│   │   ├── auth/         # Authentication
│   │   ├── expenses/     # Expense CRUD + approve + bulk upload
│   │   ├── requisitions/ # Requisition CRUD + approve + bulk upload
│   │   ├── advances/     # Advance CRUD + approve + bulk upload
│   │   ├── users/        # User CRUD + bulk upload
│   │   ├── sites/        # Site CRUD + bulk upload
│   │   ├── clients/      # Client CRUD + bulk upload
│   │   ├── categories/   # Category CRUD + bulk upload
│   │   ├── dashboard/    # Dashboard stats
│   │   └── preferences/  # User preferences
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── layout/           # AppLayout, Sidebar, Header
│   ├── dashboard/        # Dashboard
│   ├── expenses/         # Expense list, form, detail, print
│   ├── requisitions/     # Requisition list, form, detail, print
│   ├── advances/         # Advance list, form, detail, print
│   ├── users/            # User management
│   ├── sites/            # Site management
│   ├── clients/          # Client management
│   ├── categories/       # Category management
│   ├── settings/         # Settings page
│   ├── shared/           # DataTable, StatusBadge, BulkUploadDialog
│   └── ui/               # shadcn/ui components
├── lib/
│   ├── db.ts             # Prisma client
│   ├── store.ts          # Zustand store
│   └── utils.ts          # Utility functions
prisma/
├── schema.prisma         # Database schema
└── seed.ts               # Demo seed data
```

## License

Private — Internal use only.
