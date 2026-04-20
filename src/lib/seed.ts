import { db } from './db'
import { hashPassword } from './auth'

let seeded = false

export async function ensureSeeded() {
  if (seeded) return
  try {
    const count = await db.user.count()
    if (count === 0) {
      const password = hashPassword('admin123')

      // ── Users (admin login: admin@company.com / admin123) ──
      const admin = await db.user.create({
        data: { email: 'admin@company.com', password, name: 'Admin', role: 'ADMIN', isActive: true },
      })
      const accountant = await db.user.create({
        data: { email: 'accountant@company.com', password, name: 'Rajesh Kumar', role: 'ACCOUNTANT', isActive: true },
      })
      const stockManager = await db.user.create({
        data: { email: 'stock@company.com', password, name: 'Sunil Verma', role: 'STOCK_MANAGER', isActive: true },
      })
      const employee = await db.user.create({
        data: { email: 'employee@company.com', password, name: 'Amit Sharma', role: 'USER', isActive: true },
      })

      // ── Demo Clients ──
      const c1 = await db.client.create({ data: { name: 'L&T Construction', description: 'Metro Project - Phase 2', isActive: true } })
      const c2 = await db.client.create({ data: { name: 'DLF Limited', description: 'Commercial Tower Wiring', isActive: true } })
      const c3 = await db.client.create({ data: { name: 'Godrej Properties', description: 'Residential Complex', isActive: true } })

      // ── Demo Sites ──
      const s1 = await db.site.create({ data: { name: 'Metro Station A', clientId: c1.id, location: 'Sector 15, Gurgaon', budget: 500000, isActive: true } })
      const s2 = await db.site.create({ data: { name: 'Tower B - Electrical', clientId: c2.id, location: 'Cyber City, Gurgaon', budget: 300000, isActive: true } })
      const s3 = await db.site.create({ data: { name: 'Villa Complex', clientId: c3.id, location: 'Noida Expressway', budget: 200000, isActive: true } })

      // ── Demo Categories ──
      const catWires = await db.category.create({ data: { name: 'Wires & Cables', type: 'EXPENSE', isActive: true } })
      const catSwitches = await db.category.create({ data: { name: 'Switches & Panels', type: 'EXPENSE', isActive: true } })
      const catLighting = await db.category.create({ data: { name: 'Lighting', type: 'BOTH', isActive: true } })
      await db.category.create({ data: { name: 'Tools & Equipment', type: 'BOTH', isActive: true } })
      await db.category.create({ data: { name: 'Pipes & Conduits', type: 'EXPENSE', isActive: true } })
      await db.category.create({ data: { name: 'Safety Equipment', type: 'BOTH', isActive: true } })

      // ── Demo Employees ──
      await db.employee.create({ data: { userId: employee.id, employeeCode: 'EMP001', designation: 'Electrician', department: 'Site Operations', phone: '9876543210', joiningDate: new Date('2023-01-15'), baseSalary: 25000 } })
      await db.employee.create({ data: { userId: stockManager.id, employeeCode: 'EMP002', designation: 'Store Manager', department: 'Inventory', phone: '9876543211', joiningDate: new Date('2022-06-01'), baseSalary: 35000 } })

      // ── Demo Expenses ──
      await db.expense.create({
        data: {
          siteId: s1.id, categoryId: catWires.id,
          userId: employee.id, amount: 15000, description: '3mm PVC wires - 500 meters',
          expenseDate: new Date(), sellerName: 'Kei Industries', invoiceNumber: 'INV-001',
          paymentMethod: 'CASH', status: 'PENDING',
        },
      })
      await db.expense.create({
        data: {
          siteId: s2.id, categoryId: catLighting.id,
          userId: employee.id, amount: 8500, description: 'LED panel lights x25',
          expenseDate: new Date(Date.now() - 86400000), sellerName: 'Havells India', invoiceNumber: 'INV-002',
          paymentMethod: 'UPI', status: 'PENDING',
        },
      })
      await db.expense.create({
        data: {
          siteId: s1.id, categoryId: catSwitches.id,
          userId: employee.id, amount: 22000, description: 'Distribution board - 3 phase',
          expenseDate: new Date(Date.now() - 172800000), sellerName: 'Schneider Electric',
          invoiceNumber: 'INV-003', paymentMethod: 'OFFICE', status: 'ACCOUNTANT_APPROVED',
          accountantApprovedById: accountant.id, accountantApprovedAt: new Date(Date.now() - 86400000),
        },
      })

      // ── Demo Advances ──
      await db.advance.create({
        data: {
          userId: employee.id, siteId: s1.id, amount: 10000, purpose: 'Wire purchase advance',
          status: 'PENDING',
        },
      })
      await db.advance.create({
        data: {
          userId: employee.id, siteId: s2.id, amount: 5000, purpose: 'Emergency fitting purchase',
          status: 'APPROVED', accountantApprovedById: accountant.id, accountantApprovedAt: new Date(),
          adminApprovedById: admin.id, adminApprovedAt: new Date(),
        },
      })

      // ── Demo Requisition ──
      await db.requisition.create({
        data: {
          siteId: s1.id, userId: employee.id, title: 'Wiring Material Request',
          description: 'Need materials for Phase 2 wiring', requiredDate: new Date(Date.now() + 7 * 86400000),
          priority: 'HIGH', status: 'PENDING',
        },
      })

      console.log('Database seeded with demo data')
    }
    seeded = true
  } catch (error) {
    console.error('Seed error:', error instanceof Error ? error.message : error)
  }
}
