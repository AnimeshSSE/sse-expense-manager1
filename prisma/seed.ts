import { PrismaClient, type ExpenseCategory, type User } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';

function createSeedClient() {
  const databaseUrl =
    process.env.TURSO_DATABASE_URL ??
    process.env.DATABASE_URL;
  const authToken =
    process.env.TURSO_AUTH_TOKEN ??
    process.env.DATABASE_AUTH_TOKEN;

  if (databaseUrl?.startsWith('libsql://')) {
    const adapter = new PrismaLibSQL({
      url: databaseUrl,
      authToken,
    });

    return new PrismaClient({ adapter });
  }

  return new PrismaClient();
}

const prisma = createSeedClient();

type SeedExpense = {
  userIdx: number;
  title: string;
  status: string;
  dept: string;
  items: Array<{
    desc: string;
    amount: number;
    catIdx: number;
    daysAgo: number;
  }>;
};

type SeedRequisition = {
  userIdx: number;
  title: string;
  status: string;
  dept: string;
  vendor: string;
  delivery: number;
  items: Array<{
    desc: string;
    qty: number;
    price: number;
    urgency: string;
  }>;
};

type SeedAdvance = {
  userIdx: number;
  title: string;
  status: string;
  amount: number;
  dept: string;
  purpose: string;
  expectedReturn: number;
  settlement?: number;
};

async function seed() {
  // Create departments as simple references
  const departments = ['Engineering', 'Finance', 'Operations', 'Marketing', 'HR', 'Sales'];

  // Create users
  const users: User[] = [];
  const userData = [
    { name: 'Admin User', email: 'admin@sse.com', role: 'ADMIN', department: 'Finance', employeeId: 'EMP001', phone: '+91-9876543210' },
    { name: 'Rajesh Kumar', email: 'rajesh@sse.com', role: 'MANAGER', department: 'Engineering', employeeId: 'EMP002', phone: '+91-9876543211' },
    { name: 'Priya Sharma', email: 'priya@sse.com', role: 'STOCK_MANAGER', department: 'Operations', employeeId: 'EMP003', phone: '+91-9876543212' },
    { name: 'Amit Patel', email: 'amit@sse.com', role: 'EMPLOYEE', department: 'Engineering', employeeId: 'EMP004', phone: '+91-9876543213' },
    { name: 'Sunita Devi', email: 'sunita@sse.com', role: 'EMPLOYEE', department: 'Finance', employeeId: 'EMP005', phone: '+91-9876543214' },
    { name: 'Vikram Singh', email: 'vikram@sse.com', role: 'EMPLOYEE', department: 'Operations', employeeId: 'EMP006', phone: '+91-9876543215' },
    { name: 'Neha Gupta', email: 'neha@sse.com', role: 'EMPLOYEE', department: 'Marketing', employeeId: 'EMP007', phone: '+91-9876543216' },
    { name: 'Arun Joshi', email: 'arun@sse.com', role: 'MANAGER', department: 'Sales', employeeId: 'EMP008', phone: '+91-9876543217' },
    { name: 'Meena Rao', email: 'meena@sse.com', role: 'EMPLOYEE', department: 'HR', employeeId: 'EMP009', phone: '+91-9876543218' },
    { name: 'Deepak Verma', email: 'deepak@sse.com', role: 'EMPLOYEE', department: 'Engineering', employeeId: 'EMP010', phone: '+91-9876543219' },
  ];

  for (const u of userData) {
    users.push(await prisma.user.create({ data: u }));
  }

  // Create expense categories
  const categories: ExpenseCategory[] = [];
  const catData = [
    { name: 'Travel', code: 'TRVL' },
    { name: 'Meals & Entertainment', code: 'MEAL' },
    { name: 'Office Supplies', code: 'OFFC' },
    { name: 'Communication', code: 'COMM' },
    { name: 'Transportation', code: 'TRAN' },
    { name: 'Accommodation', code: 'ACCM' },
    { name: 'Training', code: 'TRNG' },
    { name: 'Miscellaneous', code: 'MISC' },
    { name: 'Client Gifts', code: 'GIFT' },
    { name: 'Equipment', code: 'EQPM' },
  ];
  for (const c of catData) {
    categories.push(await prisma.expenseCategory.create({ data: c }));
  }

  // Create expenses with items
  const expenseData: SeedExpense[] = [
    { userIdx: 3, title: 'Bangalore Client Visit', status: 'APPROVED', dept: 'Engineering', items: [
      { desc: 'Flight tickets - BLR round trip', amount: 8500, catIdx: 0, daysAgo: 25 },
      { desc: 'Hotel stay - 2 nights', amount: 4200, catIdx: 5, daysAgo: 25 },
      { desc: 'Local transport', amount: 1200, catIdx: 4, daysAgo: 24 },
      { desc: 'Client dinner', amount: 3500, catIdx: 1, daysAgo: 24 },
    ]},
    { userIdx: 4, title: 'Quarterly Team Lunch', status: 'APPROVED', dept: 'Finance', items: [
      { desc: 'Restaurant booking for 15 people', amount: 12000, catIdx: 1, daysAgo: 20 },
      { desc: 'Decoration and supplies', amount: 2000, catIdx: 2, daysAgo: 20 },
    ]},
    { userIdx: 5, title: 'Office Equipment Purchase', status: 'SUBMITTED', dept: 'Operations', items: [
      { desc: 'Printer cartridges', amount: 4500, catIdx: 9, daysAgo: 5 },
      { desc: 'Keyboard and mouse set', amount: 2500, catIdx: 9, daysAgo: 5 },
      { desc: 'Monitor stand', amount: 3000, catIdx: 9, daysAgo: 4 },
    ]},
    { userIdx: 6, title: 'Marketing Campaign Materials', status: 'SUBMITTED', dept: 'Marketing', items: [
      { desc: 'Brochure printing - 500 copies', amount: 8000, catIdx: 2, daysAgo: 3 },
      { desc: 'Social media ads', amount: 15000, catIdx: 7, daysAgo: 2 },
    ]},
    { userIdx: 9, title: 'Mumbai Conference Travel', status: 'DRAFT', dept: 'Engineering', items: [
      { desc: 'Train tickets - Mumbai round trip', amount: 3200, catIdx: 0, daysAgo: 1 },
      { desc: 'Conference registration', amount: 5000, catIdx: 6, daysAgo: 1 },
    ]},
    { userIdx: 3, title: 'Monthly Internet Bill', status: 'APPROVED', dept: 'Engineering', items: [
      { desc: 'Broadband - March 2026', amount: 1499, catIdx: 3, daysAgo: 40 },
    ]},
    { userIdx: 8, title: 'Diwali Client Gifts', status: 'APPROVED', dept: 'HR', items: [
      { desc: 'Gift hampers - 20 nos', amount: 20000, catIdx: 8, daysAgo: 60 },
      { desc: 'Gift wrapping', amount: 2000, catIdx: 2, daysAgo: 60 },
    ]},
    { userIdx: 5, title: 'Warehouse Safety Equipment', status: 'REJECTED', dept: 'Operations', items: [
      { desc: 'Safety helmets - 10 nos', amount: 5000, catIdx: 9, daysAgo: 15 },
      { desc: 'Safety vests - 10 nos', amount: 3000, catIdx: 9, daysAgo: 15 },
    ]},
    { userIdx: 6, title: 'Trade Show Participation', status: 'PAID', dept: 'Marketing', items: [
      { desc: 'Booth rental', amount: 25000, catIdx: 7, daysAgo: 50 },
      { desc: 'Travel - Delhi', amount: 6000, catIdx: 0, daysAgo: 50 },
      { desc: 'Marketing collateral', amount: 8000, catIdx: 2, daysAgo: 49 },
    ]},
    { userIdx: 4, title: 'Taxi Fare - Airport', status: 'APPROVED', dept: 'Finance', items: [
      { desc: 'Airport pickup', amount: 800, catIdx: 4, daysAgo: 30 },
    ]},
    { userIdx: 9, title: 'Online Course Subscription', status: 'SUBMITTED', dept: 'Engineering', items: [
      { desc: 'Udemy Business - Annual', amount: 12000, catIdx: 6, daysAgo: 2 },
    ]},
    { userIdx: 3, title: 'Team Building Activity', status: 'DRAFT', dept: 'Engineering', items: [
      { desc: 'Adventure park booking', amount: 8000, catIdx: 1, daysAgo: 0 },
      { desc: 'Transportation', amount: 3000, catIdx: 4, daysAgo: 0 },
    ]},
  ];

  for (const e of expenseData) {
    const totalAmount = e.items.reduce((sum, i) => sum + i.amount, 0);
    const expense = await prisma.expense.create({
      data: {
        title: e.title,
        status: e.status,
        totalAmount,
        userId: users[e.userIdx].id,
        department: e.dept,
        submittedDate: e.status !== 'DRAFT' ? new Date(Date.now() - e.items[0].daysAgo * 86400000) : null,
        approvedById: e.status === 'APPROVED' || e.status === 'PAID' ? users[1].id : (e.status === 'REJECTED' ? users[1].id : null),
        approvedAt: (e.status === 'APPROVED' || e.status === 'PAID' || e.status === 'REJECTED') ? new Date(Date.now() - (e.items[0].daysAgo - 2) * 86400000) : null,
        rejectedReason: e.status === 'REJECTED' ? 'Budget exceeded for this quarter. Please resubmit next quarter.' : null,
        paymentDate: e.status === 'PAID' ? new Date(Date.now() - 20 * 86400000) : null,
        paymentRef: e.status === 'PAID' ? 'PAY-2026-0042' : null,
      }
    });

    for (const item of e.items) {
      await prisma.expenseItem.create({
        data: {
          description: item.desc,
          amount: item.amount,
          date: new Date(Date.now() - item.daysAgo * 86400000),
          categoryId: categories[item.catIdx].id,
          expenseId: expense.id,
        }
      });
    }
  }

  // Create requisitions with items
  const requisitionData: SeedRequisition[] = [
    { userIdx: 3, title: 'Laptop for New Hire', status: 'APPROVED', dept: 'Engineering', vendor: 'Dell India', delivery: 10, items: [
      { desc: 'Dell Latitude 5540', qty: 1, price: 65000, urgency: 'HIGH' },
      { desc: 'Docking station', qty: 1, price: 8000, urgency: 'NORMAL' },
    ]},
    { userIdx: 4, title: 'Office Furniture - Finance Team', status: 'SUBMITTED', dept: 'Finance', vendor: 'Godrej Interio', delivery: 20, items: [
      { desc: 'Ergonomic chairs - 5 nos', qty: 5, price: 12000, urgency: 'NORMAL' },
      { desc: 'Standing desks - 3 nos', qty: 3, price: 25000, urgency: 'NORMAL' },
    ]},
    { userIdx: 5, title: 'Warehouse Shelving Units', status: 'SUBMITTED', dept: 'Operations', vendor: 'Local Supplier', delivery: 5, items: [
      { desc: 'Heavy duty shelves - 10 units', qty: 10, price: 5000, urgency: 'URGENT' },
      { desc: 'Shelf labels and tags', qty: 100, price: 50, urgency: 'LOW' },
    ]},
    { userIdx: 6, title: 'Marketing Event Supplies', status: 'APPROVED', dept: 'Marketing', vendor: 'Printo', delivery: 3, items: [
      { desc: 'Roll-up banners - 3 nos', qty: 3, price: 3500, urgency: 'HIGH' },
      { desc: 'Business cards - 1000 nos', qty: 1000, price: 5, urgency: 'NORMAL' },
      { desc: 'Promotional T-shirts - 50 nos', qty: 50, price: 400, urgency: 'NORMAL' },
    ]},
    { userIdx: 8, title: 'Sales Team Mobile Phones', status: 'DRAFT', dept: 'Sales', vendor: 'Samsung', delivery: 7, items: [
      { desc: 'Samsung Galaxy A54 - 5 nos', qty: 5, price: 22000, urgency: 'HIGH' },
    ]},
    { userIdx: 4, title: 'AC Repair Service', status: 'REJECTED', dept: 'Finance', vendor: 'CoolAir Services', delivery: 2, items: [
      { desc: 'AC servicing - 8 units', qty: 8, price: 1500, urgency: 'URGENT' },
    ]},
    { userIdx: 3, title: 'Projector for Conference Room', status: 'FULFILLED', dept: 'Engineering', vendor: 'Epson', delivery: 15, items: [
      { desc: 'Epson EB-X51 Projector', qty: 1, price: 45000, urgency: 'NORMAL' },
      { desc: 'Projector mount', qty: 1, price: 3000, urgency: 'NORMAL' },
    ]},
  ];

  for (const r of requisitionData) {
    const totalAmount = r.items.reduce((sum, i) => sum + (i.qty * i.price), 0);
    const requisition = await prisma.requisition.create({
      data: {
        title: r.title,
        status: r.status,
        totalAmount,
        userId: users[r.userIdx].id,
        department: r.dept,
        vendorName: r.vendor,
        deliveryDate: new Date(Date.now() + r.delivery * 86400000),
        submittedDate: r.status !== 'DRAFT' ? new Date(Date.now() - (r.delivery + 3) * 86400000) : null,
        approvedById: r.status === 'APPROVED' || r.status === 'FULFILLED' ? users[1].id : (r.status === 'REJECTED' ? users[1].id : null),
        approvedAt: (r.status === 'APPROVED' || r.status === 'FULFILLED' || r.status === 'REJECTED') ? new Date(Date.now() - (r.delivery + 1) * 86400000) : null,
        rejectedReason: r.status === 'REJECTED' ? 'Vendor not on approved vendor list. Please choose from approved vendors.' : null,
      }
    });

    for (const item of r.items) {
      await prisma.requisitionItem.create({
        data: {
          description: item.desc,
          quantity: item.qty,
          unitPrice: item.price,
          totalAmount: item.qty * item.price,
          urgency: item.urgency,
          requisitionId: requisition.id,
        }
      });
    }
  }

  // Create advances
  const advanceData: SeedAdvance[] = [
    { userIdx: 3, title: 'Delhi Client Meeting Advance', status: 'APPROVED', amount: 15000, dept: 'Engineering', purpose: 'Travel and accommodation for Delhi client meeting', expectedReturn: 30 },
    { userIdx: 6, title: 'Exhibition Setup Advance', status: 'DISBURSED', amount: 25000, dept: 'Marketing', purpose: 'Advance for setting up exhibition booth at trade fair', expectedReturn: 15 },
    { userIdx: 5, title: 'Emergency Supplies Advance', status: 'SUBMITTED', amount: 10000, dept: 'Operations', purpose: 'Emergency warehouse supplies purchase', expectedReturn: 7 },
    { userIdx: 4, title: 'Audit Travel Advance', status: 'SETTLED', amount: 20000, dept: 'Finance', purpose: 'Travel advance for branch audit visits', expectedReturn: 45, settlement: 18500 },
    { userIdx: 9, title: 'Training Program Advance', status: 'DRAFT', amount: 8000, dept: 'Engineering', purpose: 'Advance for AWS certification training', expectedReturn: 20 },
    { userIdx: 8, title: 'Sales Territory Visit', status: 'APPROVED', amount: 30000, dept: 'Sales', purpose: 'Travel advance for north India territory visits', expectedReturn: 25 },
    { userIdx: 3, title: 'Server Room Maintenance', status: 'REJECTED', amount: 5000, dept: 'Engineering', purpose: 'Emergency server room AC repair', expectedReturn: 5 },
  ];

  for (const a of advanceData) {
    await prisma.advance.create({
      data: {
        title: a.title,
        status: a.status,
        amount: a.amount,
        purpose: a.purpose,
        userId: users[a.userIdx].id,
        department: a.dept,
        expectedReturnDate: new Date(Date.now() + a.expectedReturn * 86400000),
        submittedDate: a.status !== 'DRAFT' ? new Date(Date.now() - (a.expectedReturn + 5) * 86400000) : null,
        approvedById: ['APPROVED', 'DISBURSED', 'SETTLED', 'REJECTED'].includes(a.status) ? users[1].id : null,
        approvedAt: ['APPROVED', 'DISBURSED', 'SETTLED', 'REJECTED'].includes(a.status) ? new Date(Date.now() - (a.expectedReturn + 3) * 86400000) : null,
        rejectedReason: a.status === 'REJECTED' ? 'Advance amount seems excessive. Please provide detailed breakdown.' : null,
        settlementAmount: a.settlement || null,
        settlementDate: a.status === 'SETTLED' ? new Date(Date.now() - 10 * 86400000) : null,
      }
    });
  }

  // Create user preferences for admin
  await prisma.userPreferences.create({
    data: {
      userId: users[0].id,
      tableSettings: JSON.stringify({
        expenses: { columns: ['title', 'user', 'department', 'status', 'totalAmount', 'submittedDate', 'actions'] },
        requisitions: { columns: ['title', 'user', 'department', 'vendorName', 'status', 'totalAmount', 'actions'] },
        advances: { columns: ['title', 'user', 'department', 'status', 'amount', 'purpose', 'actions'] },
      }),
    }
  });

  console.log('✅ Database seeded successfully!');
  console.log(`  - ${users.length} users created`);
  console.log(`  - ${categories.length} expense categories created`);
  console.log(`  - ${expenseData.length} expenses created`);
  console.log(`  - ${requisitionData.length} requisitions created`);
  console.log(`  - ${advanceData.length} advances created`);
}

seed()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
