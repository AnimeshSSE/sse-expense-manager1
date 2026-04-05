import { ExpenseStatus, RequisitionStatus, AdvanceStatus, Priority } from '@prisma/client';
import { db } from './src/lib/db';

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function main() {
  const adminPw = await hashPassword('admin123');
  const userPw = await hashPassword('user123');
  const acctPw = await hashPassword('accountant123');
  const stockPw = await hashPassword('stock123');

  const admin = await db.user.create({ data: { email: 'admin@demo.com', name: 'Admin User', password: adminPw, role: 'ADMIN', isActive: true } });
  const user1 = await db.user.create({ data: { email: 'user@demo.com', name: 'Amit Patel', password: userPw, role: 'USER', isActive: true } });
  const user2 = await db.user.create({ data: { email: 'user2@demo.com', name: 'Priya Sharma', password: userPw, role: 'USER', isActive: true } });
  const user3 = await db.user.create({ data: { email: 'user3@demo.com', name: 'Sneha Reddy', password: userPw, role: 'USER', isActive: true } });
  const acct = await db.user.create({ data: { email: 'accountant@demo.com', name: 'Raj Kumar', password: acctPw, role: 'ACCOUNTANT', isActive: true } });
  const stock = await db.user.create({ data: { email: 'stock@demo.com', name: 'Vikram Singh', password: stockPw, role: 'STOCK_MANAGER', isActive: true } });

  const client1 = await db.client.create({ data: { name: 'ABC Construction Co.', description: 'Major commercial construction projects', isActive: true } });
  const client2 = await db.client.create({ data: { name: 'RJIL', description: 'Telecom infrastructure', isActive: true } });

  const site1 = await db.site.create({ data: { name: 'Downtown Tower Project', clientId: client1.id, location: '123 Main St, Downtown', description: '30-story commercial tower', budget: 5000000, isActive: true } });
  const site2 = await db.site.create({ data: { name: 'Highway Bridge Project', clientId: client1.id, location: 'NH-48, Km 45', description: '6-lane highway bridge', budget: 3000000, isActive: true } });

  const catNames = ['Construction Materials', 'Equipment Rental', 'Labor Costs', 'Permits & Licenses', 'Safety Equipment', 'Transportation', 'Miscellaneous'];
  const catIds: string[] = [];
  for (const name of catNames) {
    const cat = await db.category.create({ data: { name, type: 'BOTH', description: name + ' category', isActive: true } });
    catIds.push(cat.id);
  }

  const statuses: ExpenseStatus[] = ['PENDING', 'ACCOUNTANT_APPROVED', 'ADMIN_APPROVED', 'PAID', 'RETURNED'];
  for (let i = 0; i < 20; i++) {
    const status = statuses[i % statuses.length];
    const amount = Math.round((Math.random() * 50000 + 1000) * 100) / 100;
    const daysAgo = Math.floor(Math.random() * 90);
    const date = new Date(Date.now() - daysAgo * 86400000);
    const data: Record<string, any> = {
      siteId: i % 2 === 0 ? site1.id : site2.id,
      categoryId: catIds[i % catNames.length],
      userId: [user1.id, user2.id, user3.id][i % 3],
      amount,
      description: 'Sample expense #' + (i + 1),
      expenseDate: date,
      submissionDate: date,
      sellerName: 'Vendor ' + (i + 1),
      invoiceNumber: 'INV-' + String(i + 1).padStart(4, '0'),
      status,
    };
    if (['ACCOUNTANT_APPROVED', 'ADMIN_APPROVED', 'PAID'].includes(status)) {
      data.accountantApprovedById = acct.id;
      data.accountantApprovedAt = date;
    }
    if (['ADMIN_APPROVED', 'PAID'].includes(status)) {
      data.adminApprovedById = admin.id;
      data.adminApprovedAt = date;
    }
    await db.expense.create({ data: data as any });
  }

  const mirStatuses: RequisitionStatus[] = ['PENDING', 'STOCK_MANAGER_APPROVED', 'ADMIN_APPROVED', 'ORDERED', 'RECEIVED'];
  const priorities: Priority[] = ['LOW', 'MEDIUM', 'HIGH'];
  for (let i = 0; i < 10; i++) {
    const status = mirStatuses[i % mirStatuses.length];
    const daysAgo = Math.floor(Math.random() * 60);
    const date = new Date(Date.now() - daysAgo * 86400000);
    await db.requisition.create({
      data: {
        siteId: i % 2 === 0 ? site1.id : site2.id,
        userId: [user1.id, user2.id][i % 2],
        title: 'MIR-' + String(i + 1).padStart(3, '0') + ': Materials Request',
        description: 'Materials for construction phase ' + (i + 1),
        requiredDate: new Date(date.getTime() + 14 * 86400000),
        priority: priorities[i % priorities.length],
        status,
      },
    });
  }

  const advStatuses: AdvanceStatus[] = ['PENDING', 'APPROVED', 'PAID', 'REJECTED', 'RETURNED'];
  for (let i = 0; i < 5; i++) {
    const status = advStatuses[i % advStatuses.length];
    const amount = Math.round((Math.random() * 20000 + 2000) * 100) / 100;
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date(Date.now() - daysAgo * 86400000);
    const data: Record<string, any> = {
      userId: [user1.id, user2.id, user3.id][i % 3],
      siteId: i % 2 === 0 ? site1.id : site2.id,
      amount,
      purpose: 'Site advance for ' + (i % 2 === 0 ? site1.name : site2.name),
      status,
    };
    if (['APPROVED', 'PAID'].includes(status)) {
      data.accountantApprovedById = acct.id;
      data.accountantApprovedAt = date;
    }
    if (status === 'PAID') {
      data.paidById = acct.id;
      data.paidAt = date;
    }
    if (status === 'REJECTED') {
      data.rejectionReason = 'Budget exceeded';
    }
    await db.advance.create({ data: data as any });
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
