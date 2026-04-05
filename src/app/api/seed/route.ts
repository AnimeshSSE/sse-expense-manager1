import { NextRequest, NextResponse } from 'next/server';
import { getSession, checkPermission, hashPassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { Role, PaymentMethod, Priority, CategoryType } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const forceReseed = body.force === true;

    // Check if database already has data
    const existingUsers = await db.user.count();

    // Auth protection: allow unauthenticated access only for first-time setup
    if (existingUsers > 0) {
      const session = await getSession();
      if (!session) {
        return NextResponse.json({ error: 'Authentication required for reseed' }, { status: 401 });
      }
      // Only ADMIN can force reseed
      if (forceReseed && !checkPermission(session.role, 'MANAGE_USERS')) {
        return NextResponse.json({ error: 'Only admins can reseed the database' }, { status: 403 });
      }
    }
    if (existingUsers > 0 && !forceReseed) {
      return NextResponse.json(
        { message: 'Database already has data. Use { force: true } to reseed.', userCount: existingUsers },
        { status: 200 }
      );
    }

    // If forcing reseed, delete all data in order (respect FK constraints)
    if (existingUsers > 0 && forceReseed) {
      await db.$transaction([
        db.auditLog.deleteMany(),
        db.bOQItem.deleteMany(),
        db.expense.deleteMany(),
        db.requisition.deleteMany(),
        db.advance.deleteMany(),
        db.comment.deleteMany(),
        db.site.deleteMany(),
        db.category.deleteMany(),
        db.client.deleteMany(),
        db.user.deleteMany(),
      ]);
    }

    // Hash passwords
    const adminPassword = await hashPassword('admin123');
    const accountantPassword = await hashPassword('accountant123');
    const stockPassword = await hashPassword('stock123');
    const userPassword = await hashPassword('user123');

    // Create users
    const admin = await db.user.create({
      data: {
        email: 'admin@demo.com',
        name: 'Admin User',
        password: adminPassword,
        role: Role.ADMIN,
      },
    });

    const accountant = await db.user.create({
      data: {
        email: 'accountant@demo.com',
        name: 'Accountant User',
        password: accountantPassword,
        role: Role.ACCOUNTANT,
      },
    });

    const stockManager = await db.user.create({
      data: {
        email: 'stock@demo.com',
        name: 'Stock Manager',
        password: stockPassword,
        role: Role.STOCK_MANAGER,
      },
    });

    const regularUser = await db.user.create({
      data: {
        email: 'user@demo.com',
        name: 'Regular User',
        password: userPassword,
        role: Role.USER,
      },
    });

    const user2 = await db.user.create({
      data: {
        email: 'user2@demo.com',
        name: 'John Smith',
        password: userPassword,
        role: Role.USER,
      },
    });

    // Create clients
    const client1 = await db.client.create({
      data: {
        name: 'ABC Construction Co.',
        description: 'Major commercial construction projects',
      },
    });

    const client2 = await db.client.create({
      data: {
        name: 'XYZ Builders Ltd.',
        description: 'Residential and commercial building',
      },
    });

    const client3 = await db.client.create({
      data: {
        name: 'Sunrise Developers',
        description: 'Real estate development company',
      },
    });

    // Create sites
    const site1 = await db.site.create({
      data: {
        name: 'Downtown Tower Project',
        clientId: client1.id,
        location: '123 Main St, Downtown',
        description: '30-story commercial tower',
        budget: 5000000,
      },
    });

    const site2 = await db.site.create({
      data: {
        name: 'Harbor Bridge Renovation',
        clientId: client1.id,
        location: 'Harbor District',
        description: 'Bridge renovation and expansion',
        budget: 3000000,
      },
    });

    const site3 = await db.site.create({
      data: {
        name: 'Riverside Apartments',
        clientId: client2.id,
        location: '456 River Road',
        description: '200-unit residential complex',
        budget: 8000000,
      },
    });

    const site4 = await db.site.create({
      data: {
        name: 'Shopping Mall Phase 2',
        clientId: client2.id,
        location: '789 Commerce Blvd',
        description: 'Mall expansion - Phase 2',
        budget: 12000000,
      },
    });

    const site5 = await db.site.create({
      data: {
        name: 'Tech Park Building A',
        clientId: client3.id,
        location: '321 Innovation Drive',
        description: 'Office building for tech companies',
        budget: 6500000,
      },
    });

    const site6 = await db.site.create({
      data: {
        name: 'Sunrise Villa Estate',
        clientId: client3.id,
        location: '555 Sunset Lane',
        description: 'Luxury villa development',
        budget: 15000000,
      },
    });

    // Create categories
    const cat1 = await db.category.create({
      data: { name: 'Construction Materials', type: CategoryType.BOTH, description: 'Raw materials for construction' },
    });
    const cat2 = await db.category.create({
      data: { name: 'Labor & Wages', type: CategoryType.EXPENSE, description: 'Worker wages and overtime' },
    });
    const cat3 = await db.category.create({
      data: { name: 'Equipment Rental', type: CategoryType.BOTH, description: 'Machinery and equipment rentals' },
    });
    const cat4 = await db.category.create({
      data: { name: 'Transportation', type: CategoryType.BOTH, description: 'Vehicle and logistics costs' },
    });
    const cat5 = await db.category.create({
      data: { name: 'Office Supplies', type: CategoryType.EXPENSE, description: 'Stationery, printing, etc.' },
    });
    const cat6 = await db.category.create({
      data: { name: 'Electrical & Plumbing', type: CategoryType.BOTH, description: 'Electrical and plumbing materials' },
    });
    const cat7 = await db.category.create({
      data: { name: 'Safety Equipment', type: CategoryType.BOTH, description: 'PPE and safety gear' },
    });
    const cat8 = await db.category.create({
      data: { name: 'Permits & Licenses', type: CategoryType.EXPENSE, description: 'Government permits and fees' },
    });

    // Create demo expenses
    const now = new Date();
    const expenseData = [
      {
        siteId: site1.id, categoryId: cat1.id, userId: regularUser.id,
        amount: 15000, description: 'Cement and steel bars for floor 5',
        expenseDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2),
        sellerName: 'BuildMart Supplies', invoiceNumber: 'INV-2024-001',
        paymentMethod: PaymentMethod.OFFICE, status: 'PENDING' as const,
      },
      {
        siteId: site1.id, categoryId: cat2.id, userId: regularUser.id,
        amount: 8500, description: 'Weekly labor wages - week 12',
        expenseDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3),
        paymentMethod: PaymentMethod.CASH, status: 'PENDING' as const,
      },
      {
        siteId: site2.id, categoryId: cat3.id, userId: user2.id,
        amount: 22000, description: 'Crane rental for 2 weeks',
        expenseDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5),
        sellerName: 'HeavyEquip Rentals', invoiceNumber: 'INV-2024-002',
        paymentMethod: PaymentMethod.CREDIT, status: 'ACCOUNTANT_APPROVED' as const,
        accountantApprovedById: accountant.id,
        accountantApprovedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 4),
      },
      {
        siteId: site3.id, categoryId: cat4.id, userId: regularUser.id,
        amount: 3200, description: 'Material transport to Riverside site',
        expenseDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7),
        sellerName: 'FastFreight Logistics', invoiceNumber: 'INV-2024-003',
        paymentMethod: PaymentMethod.UPI, status: 'ACCOUNTANT_APPROVED' as const,
        accountantApprovedById: accountant.id,
        accountantApprovedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6),
      },
      {
        siteId: site1.id, categoryId: cat5.id, userId: user2.id,
        amount: 1200, description: 'Printer cartridges and stationery',
        expenseDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
        paymentMethod: PaymentMethod.CASH, status: 'ADMIN_APPROVED' as const,
        accountantApprovedById: accountant.id,
        accountantApprovedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
        adminApprovedById: admin.id,
        adminApprovedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      },
      {
        siteId: site4.id, categoryId: cat6.id, userId: regularUser.id,
        amount: 45000, description: 'Complete electrical wiring - Phase 2',
        expenseDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 10),
        sellerName: 'PowerLine Electric', invoiceNumber: 'INV-2024-004',
        paymentMethod: PaymentMethod.OFFICE, status: 'PAID' as const,
        accountantApprovedById: accountant.id,
        accountantApprovedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 9),
        adminApprovedById: admin.id,
        adminApprovedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 8),
      },
      {
        siteId: site2.id, categoryId: cat7.id, userId: user2.id,
        amount: 5500, description: 'Safety helmets, vests, and gloves',
        expenseDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 4),
        sellerName: 'SafeWork Gear Co.', invoiceNumber: 'INV-2024-005',
        paymentMethod: PaymentMethod.OFFICE, status: 'PAID' as const,
        accountantApprovedById: accountant.id,
        accountantApprovedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3),
        adminApprovedById: admin.id,
        adminApprovedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2),
      },
      {
        siteId: site5.id, categoryId: cat8.id, userId: regularUser.id,
        amount: 7500, description: 'Building permit renewal',
        expenseDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6),
        paymentMethod: PaymentMethod.OFFICE, status: 'REJECTED' as const,
        rejectionReason: 'Permit number not clearly mentioned. Please resubmit with correct details.',
      },
      {
        siteId: site3.id, categoryId: cat1.id, userId: user2.id,
        amount: 28000, description: 'Concrete blocks and tiles order',
        expenseDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 8),
        sellerName: 'ConcreteKing Ltd.', invoiceNumber: 'INV-2024-006',
        paymentMethod: PaymentMethod.CREDIT, status: 'RETURNED' as const,
        returnReason: 'Please update the quantity. The site manager confirmed 150 pallets, not 200.',
      },
      {
        siteId: site6.id, categoryId: cat3.id, userId: regularUser.id,
        amount: 18000, description: 'Excavator rental for foundation work',
        expenseDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 12),
        sellerName: 'EarthMovers Inc.', invoiceNumber: 'INV-2024-007',
        paymentMethod: PaymentMethod.OFFICE, status: 'PAID' as const,
        accountantApprovedById: accountant.id,
        accountantApprovedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 11),
        adminApprovedById: admin.id,
        adminApprovedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 10),
      },
      {
        siteId: site1.id, categoryId: cat4.id, userId: user2.id,
        amount: 4100, description: 'Fuel for site vehicles - month 3',
        expenseDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3),
        paymentMethod: PaymentMethod.CASH, status: 'PENDING' as const,
      },
      {
        siteId: site4.id, categoryId: cat2.id, userId: regularUser.id,
        amount: 12000, description: 'Overtime payments for weekend work',
        expenseDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
        paymentMethod: PaymentMethod.OFFICE, status: 'ACCOUNTANT_APPROVED' as const,
        accountantApprovedById: accountant.id,
        accountantApprovedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      },
      {
        siteId: site5.id, categoryId: cat6.id, userId: user2.id,
        amount: 19500, description: 'Plumbing materials for restrooms',
        expenseDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 9),
        sellerName: 'AquaFlow Plumbing', invoiceNumber: 'INV-2024-008',
        paymentMethod: PaymentMethod.CREDIT, status: 'ADMIN_APPROVED' as const,
        accountantApprovedById: accountant.id,
        accountantApprovedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 8),
        adminApprovedById: admin.id,
        adminApprovedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7),
      },
      {
        siteId: site2.id, categoryId: cat1.id, userId: regularUser.id,
        amount: 35000, description: 'Structural steel beams',
        expenseDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14),
        sellerName: 'SteelWorld Manufacturing', invoiceNumber: 'INV-2024-009',
        paymentMethod: PaymentMethod.OFFICE, status: 'PAID' as const,
        accountantApprovedById: accountant.id,
        accountantApprovedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13),
        adminApprovedById: admin.id,
        adminApprovedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 12),
      },
      {
        siteId: site3.id, categoryId: cat7.id, userId: user2.id,
        amount: 2800, description: 'Fire safety equipment and extinguishers',
        expenseDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5),
        sellerName: 'FireGuard Supplies', invoiceNumber: 'INV-2024-010',
        paymentMethod: PaymentMethod.OFFICE, status: 'REJECTED' as const,
        rejectionReason: 'Incorrect vendor. Please use approved supplier from the vendor list.',
      },
      {
        siteId: site6.id, categoryId: cat5.id, userId: regularUser.id,
        amount: 950, description: 'Site office supplies - printer paper, pens',
        expenseDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2),
        paymentMethod: PaymentMethod.CASH, status: 'PENDING' as const,
      },
    ];

    for (const exp of expenseData) {
      const submissionDate = new Date(exp.expenseDate);
      const daysDiff = Math.floor(
        (now.getTime() - submissionDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const isLateSubmission = daysDiff > 7;
      const daysLate = isLateSubmission ? daysDiff : 0;

      await db.expense.create({
        data: {
          ...exp,
          submissionDate: new Date(exp.expenseDate.getTime() + 86400000), // next day
          isLateSubmission,
          daysLate,
        },
      });
    }

    // Create demo requisitions with BOQ items
    const requisitionData = [
      {
        siteId: site1.id, userId: regularUser.id,
        title: 'MIR-001: Floor 5 Construction Materials',
        description: 'Materials needed for floor 5 structural work',
        requiredDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14),
        priority: Priority.HIGH, status: 'PENDING' as const,
        boqItems: [
          { itemName: 'Portland Cement (50kg bags)', quantity: 500, unit: 'bags', unitPrice: 450 },
          { itemName: 'TMT Steel Bars (12mm)', quantity: 200, unit: 'pieces', unitPrice: 850 },
          { itemName: 'Plywood Sheets (18mm)', quantity: 100, unit: 'sheets', unitPrice: 1200 },
        ],
      },
      {
        siteId: site2.id, userId: user2.id,
        title: 'MIR-002: Bridge Reinforcement Steel',
        description: 'Steel reinforcement for bridge deck',
        requiredDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 21),
        priority: Priority.URGENT, status: 'STOCK_MANAGER_APPROVED' as const,
        stockManagerApprovedById: stockManager.id,
        stockManagerApprovedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2),
        boqItems: [
          { itemName: 'Rebar 20mm', quantity: 1000, unit: 'pieces', unitPrice: 1200 },
          { itemName: 'Rebar 25mm', quantity: 500, unit: 'pieces', unitPrice: 1500 },
          { itemName: 'Binding Wire', quantity: 50, unit: 'kg', unitPrice: 80 },
        ],
      },
      {
        siteId: site3.id, userId: regularUser.id,
        title: 'MIR-003: Electrical Fittings for Apartments',
        description: 'Complete electrical fittings for 50 units',
        requiredDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30),
        priority: Priority.MEDIUM, status: 'ADMIN_APPROVED' as const,
        stockManagerApprovedById: stockManager.id,
        stockManagerApprovedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5),
        adminApprovedById: admin.id,
        adminApprovedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3),
        boqItems: [
          { itemName: 'MCB Distribution Board', quantity: 50, unit: 'units', unitPrice: 3500 },
          { itemName: 'Wiring Cable (3 core 4mm)', quantity: 5000, unit: 'meters', unitPrice: 45 },
          { itemName: 'Switches (Modular)', quantity: 800, unit: 'units', unitPrice: 150 },
          { itemName: 'Power Outlets', quantity: 600, unit: 'units', unitPrice: 180 },
        ],
      },
      {
        siteId: site4.id, userId: user2.id,
        title: 'MIR-004: HVAC System Components',
        description: 'HVAC materials for mall expansion',
        requiredDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 45),
        priority: Priority.LOW, status: 'ORDERED' as const,
        stockManagerApprovedById: stockManager.id,
        stockManagerApprovedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 10),
        adminApprovedById: admin.id,
        adminApprovedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 8),
        boqItems: [
          { itemName: 'Ducting (GI Sheet)', quantity: 200, unit: 'sheets', unitPrice: 2200 },
          { itemName: 'Insulation Material', quantity: 100, unit: 'rolls', unitPrice: 1500 },
          { itemName: 'HVAC Grilles', quantity: 150, unit: 'units', unitPrice: 800 },
        ],
      },
      {
        siteId: site5.id, userId: regularUser.id,
        title: 'MIR-005: Plumbing Supplies',
        description: 'Complete plumbing for office building',
        requiredDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 20),
        priority: Priority.MEDIUM, status: 'RECEIVED' as const,
        stockManagerApprovedById: stockManager.id,
        stockManagerApprovedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 15),
        adminApprovedById: admin.id,
        adminApprovedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13),
        boqItems: [
          { itemName: 'PVC Pipes (4 inch)', quantity: 300, unit: 'pieces', unitPrice: 350 },
          { itemName: 'CPVC Fittings Set', quantity: 100, unit: 'sets', unitPrice: 800 },
          { itemName: 'Water Tanks (1000L)', quantity: 5, unit: 'units', unitPrice: 15000 },
        ],
      },
      {
        siteId: site6.id, userId: user2.id,
        title: 'MIR-006: Luxury Finishing Materials',
        description: 'Premium materials for villa interiors',
        requiredDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 25),
        priority: Priority.HIGH, status: 'REJECTED' as const,
        rejectionReason: 'Budget exceeded. Please revise quantities and resubmit.',
        boqItems: [
          { itemName: 'Italian Marble Tiles', quantity: 500, unit: 'sqm', unitPrice: 3500 },
          { itemName: 'Hardwood Flooring', quantity: 200, unit: 'sqm', unitPrice: 2800 },
        ],
      },
      {
        siteId: site1.id, userId: regularUser.id,
        title: 'MIR-007: Safety Equipment Restock',
        description: 'Monthly safety equipment restock',
        requiredDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 10),
        priority: Priority.MEDIUM, status: 'RETURNED' as const,
        returnReason: 'Please specify exact sizes for safety boots and include PPE certifications.',
        boqItems: [
          { itemName: 'Safety Helmets', quantity: 50, unit: 'units', unitPrice: 450 },
          { itemName: 'Safety Boots', quantity: 50, unit: 'pairs', unitPrice: 1800 },
          { itemName: 'Reflective Vests', quantity: 100, unit: 'units', unitPrice: 250 },
        ],
      },
      {
        siteId: site3.id, userId: user2.id,
        title: 'MIR-008: Painting Materials',
        description: 'Interior and exterior paint supplies',
        requiredDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 18),
        priority: Priority.LOW, status: 'PENDING' as const,
        boqItems: [
          { itemName: 'Emulsion Paint (20L)', quantity: 100, unit: 'buckets', unitPrice: 2500 },
          { itemName: 'Primer (20L)', quantity: 50, unit: 'buckets', unitPrice: 1800 },
          { itemName: 'Paint Rollers', quantity: 200, unit: 'units', unitPrice: 150 },
          { itemName: 'Paint Brushes (set)', quantity: 100, unit: 'sets', unitPrice: 350 },
        ],
      },
    ];

    for (const req of requisitionData) {
      const totalAmount = req.boqItems.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      );

      await db.requisition.create({
        data: {
          siteId: req.siteId,
          userId: req.userId,
          title: req.title,
          description: req.description,
          requiredDate: req.requiredDate,
          priority: req.priority,
          status: req.status,
          totalAmount,
          stockManagerApprovedById: req.stockManagerApprovedById || undefined,
          stockManagerApprovedAt: req.stockManagerApprovedAt || undefined,
          adminApprovedById: req.adminApprovedById || undefined,
          adminApprovedAt: req.adminApprovedAt || undefined,
          rejectionReason: req.rejectionReason || undefined,
          returnReason: req.returnReason || undefined,
          boqItems: {
            create: req.boqItems.map((item) => ({
              itemName: item.itemName,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice,
            })),
          },
        },
      });
    }

    const totalExpenses = await db.expense.count();
    const totalRequisitions = await db.requisition.count();

    return NextResponse.json({
      message: 'Database seeded successfully with demo data',
      stats: {
        users: 5,
        clients: 3,
        sites: 6,
        categories: 8,
        expenses: totalExpenses,
        requisitions: totalRequisitions,
      },
      ...(process.env.NODE_ENV !== 'production' ? {
        demoAccounts: {
          admin: { email: 'admin@demo.com', password: 'admin123' },
          accountant: { email: 'accountant@demo.com', password: 'accountant123' },
          stockManager: { email: 'stock@demo.com', password: 'stock123' },
          user: { email: 'user@demo.com', password: 'user123' },
          user2: { email: 'user2@demo.com', password: 'user123' },
        },
      } : {}),
    });
  } catch (error: any) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
