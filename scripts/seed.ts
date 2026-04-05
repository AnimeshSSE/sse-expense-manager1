import { db } from '../src/lib/db'
import { Role, PaymentMethod, Priority, CategoryType } from '@prisma/client'
import bcrypt from 'bcryptjs'

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

// Helper to create a date N days ago
function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(8, 0, 0, 0)
  return d
}

function daysFromNow(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + n)
  d.setHours(8, 0, 0, 0)
  return d
}

// Seeded pseudo-random for consistency
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

const rand = seededRandom(42)

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)]
}

function randBetween(min: number, max: number): number {
  return Math.round((min + rand() * (max - min)) * 100) / 100
}

async function main() {
  // Clear all data first
  await db.auditLog.deleteMany()
  await db.comment.deleteMany()
  await db.bOQItem.deleteMany()
  await db.expense.deleteMany()
  await db.requisition.deleteMany()
  await db.advance.deleteMany()
  await db.category.deleteMany()
  await db.site.deleteMany()
  await db.client.deleteMany()
  await db.user.deleteMany()

  // ============ USERS ============
  const adminPassword = await hashPassword('admin123')
  const accountantPassword = await hashPassword('accountant123')
  const stockPassword = await hashPassword('stock123')
  const userPassword = await hashPassword('user123')

  const admin = await db.user.create({ data: { email: 'admin@demo.com', name: 'Admin User', password: adminPassword, role: Role.ADMIN } })
  const accountant = await db.user.create({ data: { email: 'accountant@demo.com', name: 'Priya Sharma', password: accountantPassword, role: Role.ACCOUNTANT } })
  const stockManager = await db.user.create({ data: { email: 'stock@demo.com', name: 'Rajesh Kumar', password: stockPassword, role: Role.STOCK_MANAGER } })
  const user1 = await db.user.create({ data: { email: 'user@demo.com', name: 'Amit Patel', password: userPassword, role: Role.USER } })
  const user2 = await db.user.create({ data: { email: 'user2@demo.com', name: 'John Smith', password: userPassword, role: Role.USER } })
  const user3 = await db.user.create({ data: { email: 'user3@demo.com', name: 'Sneha Reddy', password: userPassword, role: Role.USER } })

  const users = [user1, user2, user3]

  // ============ CLIENTS ============
  const client1 = await db.client.create({ data: { name: 'ABC Construction Co.', description: 'Major commercial construction projects' } })
  const client2 = await db.client.create({ data: { name: 'XYZ Builders Ltd.', description: 'Residential and commercial building' } })
  const client3 = await db.client.create({ data: { name: 'Sunrise Developers', description: 'Real estate development company' } })

  // ============ SITES ============
  const sites = [
    await db.site.create({ data: { name: 'Downtown Tower Project', clientId: client1.id, location: '123 Main St, Downtown', description: '30-story commercial tower', budget: 5000000 } }),
    await db.site.create({ data: { name: 'Harbor Bridge Renovation', clientId: client1.id, location: 'Harbor District', description: 'Bridge renovation and expansion', budget: 3000000 } }),
    await db.site.create({ data: { name: 'Riverside Apartments', clientId: client2.id, location: '456 River Road', description: '200-unit residential complex', budget: 8000000 } }),
    await db.site.create({ data: { name: 'Shopping Mall Phase 2', clientId: client2.id, location: '789 Commerce Blvd', description: 'Mall expansion - Phase 2', budget: 12000000 } }),
    await db.site.create({ data: { name: 'Tech Park Building A', clientId: client3.id, location: '321 Innovation Drive', description: 'Office building for tech companies', budget: 6500000 } }),
    await db.site.create({ data: { name: 'Sunrise Villa Estate', clientId: client3.id, location: '555 Sunset Lane', description: 'Luxury villa development', budget: 15000000 } }),
  ]

  // ============ CATEGORIES ============
  const categories = [
    await db.category.create({ data: { name: 'Construction Materials', type: CategoryType.BOTH, description: 'Raw materials for construction' } }),
    await db.category.create({ data: { name: 'Labor & Wages', type: CategoryType.EXPENSE, description: 'Worker wages and overtime' } }),
    await db.category.create({ data: { name: 'Equipment Rental', type: CategoryType.BOTH, description: 'Machinery and equipment rentals' } }),
    await db.category.create({ data: { name: 'Transportation', type: CategoryType.BOTH, description: 'Vehicle and logistics costs' } }),
    await db.category.create({ data: { name: 'Office Supplies', type: CategoryType.EXPENSE, description: 'Stationery, printing, etc.' } }),
    await db.category.create({ data: { name: 'Electrical & Plumbing', type: CategoryType.BOTH, description: 'Electrical and plumbing materials' } }),
    await db.category.create({ data: { name: 'Safety Equipment', type: CategoryType.BOTH, description: 'PPE and safety gear' } }),
    await db.category.create({ data: { name: 'Permits & Licenses', type: CategoryType.EXPENSE, description: 'Government permits and fees' } }),
  ]

  // Expense descriptions per category
  const expenseDescriptions: Record<string, string[]> = {
    'Construction Materials': [
      'Cement and steel bars for structural work', 'Concrete blocks and tiles order', 'Sand and gravel delivery',
      'Bricks procurement for boundary wall', 'Aggregate supply for foundation', 'Timber and plywood sheets',
      'Roofing tiles and waterproofing material', 'Steel reinforcement bars (TMT)', 'Ready-mix concrete delivery',
      'Fly ash bricks for internal walls', 'Granite slabs for flooring', 'Aluminium window frames',
      'Glass panels for facade', 'Cement bags (OPC 53 grade)', 'River sand supply',
    ],
    'Labor & Wages': [
      'Weekly labor wages - Week {w}', 'Overtime payments for weekend work', 'Mason team daily wages',
      'Electrician team weekly payment', 'Plumber wages - biweekly', 'Site supervisor salary',
      'Security guard monthly pay', 'Skilled worker daily wages', 'Helper labor charges',
      'Painter team weekly wages', 'Welding team payment', 'Crane operator wages',
    ],
    'Equipment Rental': [
      'Crane rental for 2 weeks', 'Excavator rental for foundation work', 'Concrete mixer rental',
      'Scaffolding rental - monthly', 'Generator rental for site power', 'Compactor rental for soil',
      'Tower crane monthly rental', 'Bar bending machine rental', 'Jackhammer rental',
      'Water pump rental', 'Plate compactor rental', 'Concrete vibrator rental',
    ],
    'Transportation': [
      'Material transport to site', 'Fuel for site vehicles', 'Heavy equipment transport',
      'Steel delivery truck charges', 'Cement bags transportation', 'Machinery relocation cost',
      'Daily worker shuttle service', 'Diesel for generators', 'Site vehicle maintenance',
      'Long-distance material delivery', 'Container unloading charges', 'Site-to-site transfer',
    ],
    'Office Supplies': [
      'Printer cartridges and stationery', 'Site office supplies', 'Blueprint printing costs',
      'Engineering drawing copies', 'Safety sign boards', 'Site office furniture',
      'Computer accessories for site office', 'First aid kit supplies', 'Drinking water supply',
      'Notice board and display materials', 'File folders and documentation', 'WiFi router for site office',
    ],
    'Electrical & Plumbing': [
      'Complete electrical wiring - Phase {p}', 'Plumbing materials for restrooms', 'MCB distribution boards',
      'Wiring cables and conduits', 'Switch and socket installations', 'Water pump set',
      'PVC pipes and fittings', 'LED lighting fixtures', 'Earthing materials',
      'Submersible pump', 'Sanitary ware installation', 'Cable tray and trunking',
    ],
    'Safety Equipment': [
      'Safety helmets and vests', 'Fire safety equipment', 'First aid boxes',
      'Safety boots procurement', 'Reflective jackets', 'Fall protection gear',
      'Gas detector equipment', 'Emergency eyewash station', 'Safety barriers and cones',
      'Respiratory protection masks', 'Harness and lanyard sets', 'Safety signage',
    ],
    'Permits & Licenses': [
      'Building permit renewal', 'Environmental clearance fee', 'Fire safety inspection',
      'Municipality approval charges', 'Labour department registration', 'GST filing and audit',
      'Insurance premium - site', 'Water connection charges', 'Electricity connection fee',
      'Road usage permit', 'Noise pollution clearance', 'Structural audit fee',
    ],
  }

  const sellers = [
    'BuildMart Supplies', 'HeavyEquip Rentals', 'FastFreight Logistics', 'PowerLine Electric',
    'SafeWork Gear Co.', 'ConcreteKing Ltd.', 'EarthMovers Inc.', 'SteelWorld Manufacturing',
    'FireGuard Supplies', 'AquaFlow Plumbing', 'GreenBuild Materials', 'Metro Hardware',
    'National Cements', 'Precision Tools', 'QuickDeliver Services', 'Royal Traders',
  ]

  const paymentMethods = [PaymentMethod.CASH, PaymentMethod.UPI, PaymentMethod.CREDIT, PaymentMethod.OFFICE, PaymentMethod.OFFICE]

  // ============ EXPENSES (110 entries) ============
  const statuses: Array<'PENDING' | 'ACCOUNTANT_APPROVED' | 'ADMIN_APPROVED' | 'PAID' | 'REJECTED' | 'RETURNED'> = [
    'PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING',
    'PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING',
    'PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING',
    'ACCOUNTANT_APPROVED', 'ACCOUNTANT_APPROVED', 'ACCOUNTANT_APPROVED', 'ACCOUNTANT_APPROVED', 'ACCOUNTANT_APPROVED',
    'ACCOUNTANT_APPROVED', 'ACCOUNTANT_APPROVED', 'ACCOUNTANT_APPROVED',
    'ADMIN_APPROVED', 'ADMIN_APPROVED', 'ADMIN_APPROVED', 'ADMIN_APPROVED',
    'PAID', 'PAID', 'PAID', 'PAID', 'PAID', 'PAID', 'PAID', 'PAID', 'PAID',
    'PAID', 'PAID', 'PAID', 'PAID', 'PAID', 'PAID', 'PAID', 'PAID', 'PAID', 'PAID',
    'PAID', 'PAID', 'PAID', 'PAID', 'PAID', 'PAID', 'PAID', 'PAID', 'PAID', 'PAID',
    'REJECTED', 'REJECTED', 'REJECTED', 'REJECTED', 'REJECTED',
    'RETURNED', 'RETURNED', 'RETURNED', 'RETURNED',
  ]

  const expenseAmountsByCategory: Record<string, [number, number]> = {
    'Construction Materials': [5000, 80000],
    'Labor & Wages': [3000, 25000],
    'Equipment Rental': [5000, 50000],
    'Transportation': [1000, 15000],
    'Office Supplies': [500, 5000],
    'Electrical & Plumbing': [3000, 55000],
    'Safety Equipment': [1500, 12000],
    'Permits & Licenses': [2000, 20000],
  }

  let expenseCount = 0
  const expenseData: any[] = []

  for (let i = 0; i < 110; i++) {
    const site = pick(sites)
    const cat = pick(categories)
    const user = pick(users)
    const status = statuses[i % statuses.length]
    const daysBack = Math.floor(rand() * 90) // 0 to 89 days ago (includes today)
    const expenseDate = daysAgo(daysBack)
    const submissionDate = new Date(expenseDate.getTime() + Math.floor(rand() * 3) * 86400000)

    const [minAmt, maxAmt] = expenseAmountsByCategory[cat.name] || [1000, 20000]
    const amount = randBetween(minAmt, maxAmt)

    const descriptions = expenseDescriptions[cat.name] || ['General expense']
    let description = pick(descriptions)
    description = description.replace('{w}', String(Math.floor(rand() * 26) + 1))
    description = description.replace('{p}', String(Math.floor(rand() * 5) + 1))

    const isLateSubmission = daysBack > 7
    const daysLate = isLateSubmission ? daysBack : 0

    const entry: any = {
      siteId: site.id,
      categoryId: cat.id,
      userId: user.id,
      amount,
      description,
      expenseDate,
      submissionDate,
      sellerName: rand() > 0.2 ? pick(sellers) : null,
      invoiceNumber: `INV-${2025 - Math.floor(daysBack / 365)}-${String(i + 1).padStart(3, '0')}`,
      paymentMethod: pick(paymentMethods),
      status,
      isLateSubmission,
      daysLate,
      notes: rand() > 0.7 ? 'Urgent delivery required' : null,
    }

    // Add approval fields based on status
    if (status === 'ACCOUNTANT_APPROVED' || status === 'ADMIN_APPROVED' || status === 'PAID') {
      entry.accountantApprovedById = accountant.id
      entry.accountantApprovedAt = new Date(submissionDate.getTime() + 86400000)
    }
    if (status === 'ADMIN_APPROVED' || status === 'PAID') {
      entry.adminApprovedById = admin.id
      entry.adminApprovedAt = new Date(entry.accountantApprovedAt.getTime() + 86400000)
    }
    if (status === 'REJECTED') {
      const rejectionReasons = ['Invoice not attached', 'Amount exceeds budget', 'Duplicate entry', 'Incorrect vendor details', 'Missing approval signature', 'Description too vague']
      entry.rejectionReason = pick(rejectionReasons)
    }
    if (status === 'RETURNED') {
      const returnReasons = ['Please update the quantity', 'Incorrect category selected', 'Add more details to description', 'Wrong site selected', 'Amount seems incorrect', 'Please attach supporting documents']
      entry.returnReason = pick(returnReasons)
    }

    expenseData.push(entry)
    expenseCount++
  }

  // Create expenses in batches
  for (let i = 0; i < expenseData.length; i += 10) {
    const batch = expenseData.slice(i, i + 10)
    await Promise.all(batch.map(e => db.expense.create({ data: e })))
  }

  // ============ REQUISITIONS (25 entries) ============
  const mirTitles = [
    { title: 'MIR-001: Floor 5 Construction Materials', desc: 'Materials for floor 5 structural work', items: [
      { itemName: 'Portland Cement (50kg bags)', quantity: 500, unit: 'bags', unitPrice: 450 },
      { itemName: 'TMT Steel Bars (12mm)', quantity: 200, unit: 'pieces', unitPrice: 850 },
      { itemName: 'Plywood Sheets (18mm)', quantity: 100, unit: 'sheets', unitPrice: 1200 },
    ]},
    { title: 'MIR-002: Bridge Reinforcement Steel', desc: 'Steel reinforcement for bridge deck', items: [
      { itemName: 'Rebar 20mm', quantity: 1000, unit: 'pieces', unitPrice: 1200 },
      { itemName: 'Rebar 25mm', quantity: 500, unit: 'pieces', unitPrice: 1500 },
      { itemName: 'Binding Wire', quantity: 50, unit: 'kg', unitPrice: 80 },
    ]},
    { title: 'MIR-003: Electrical Fittings for Apartments', desc: 'Complete electrical fittings for 50 units', items: [
      { itemName: 'MCB Distribution Board', quantity: 50, unit: 'units', unitPrice: 3500 },
      { itemName: 'Wiring Cable (3 core 4mm)', quantity: 5000, unit: 'meters', unitPrice: 45 },
      { itemName: 'Modular Switches', quantity: 800, unit: 'units', unitPrice: 150 },
      { itemName: 'Power Outlets', quantity: 600, unit: 'units', unitPrice: 180 },
    ]},
    { title: 'MIR-004: HVAC System Components', desc: 'HVAC materials for mall expansion', items: [
      { itemName: 'Ducting (GI Sheet)', quantity: 200, unit: 'sheets', unitPrice: 2200 },
      { itemName: 'Insulation Material', quantity: 100, unit: 'rolls', unitPrice: 1500 },
      { itemName: 'HVAC Grilles', quantity: 150, unit: 'units', unitPrice: 800 },
    ]},
    { title: 'MIR-005: Plumbing Supplies for Tech Park', desc: 'Complete plumbing for office building', items: [
      { itemName: 'PVC Pipes (4 inch)', quantity: 300, unit: 'pieces', unitPrice: 350 },
      { itemName: 'CPVC Fittings Set', quantity: 100, unit: 'sets', unitPrice: 800 },
      { itemName: 'Water Tanks (1000L)', quantity: 5, unit: 'units', unitPrice: 15000 },
    ]},
    { title: 'MIR-006: Luxury Finishing Materials', desc: 'Premium materials for villa interiors', items: [
      { itemName: 'Italian Marble Tiles', quantity: 500, unit: 'sqm', unitPrice: 3500 },
      { itemName: 'Hardwood Flooring', quantity: 200, unit: 'sqm', unitPrice: 2800 },
    ]},
    { title: 'MIR-007: Safety Equipment Restock', desc: 'Monthly safety equipment restock', items: [
      { itemName: 'Safety Helmets', quantity: 50, unit: 'units', unitPrice: 450 },
      { itemName: 'Safety Boots', quantity: 50, unit: 'pairs', unitPrice: 1800 },
      { itemName: 'Reflective Vests', quantity: 100, unit: 'units', unitPrice: 250 },
    ]},
    { title: 'MIR-008: Painting Materials', desc: 'Interior and exterior paint supplies', items: [
      { itemName: 'Emulsion Paint (20L)', quantity: 100, unit: 'buckets', unitPrice: 2500 },
      { itemName: 'Primer (20L)', quantity: 50, unit: 'buckets', unitPrice: 1800 },
      { itemName: 'Paint Rollers', quantity: 200, unit: 'units', unitPrice: 150 },
      { itemName: 'Paint Brushes (set)', quantity: 100, unit: 'sets', unitPrice: 350 },
    ]},
    { title: 'MIR-009: Foundation Concrete Materials', desc: 'Materials for villa foundation work', items: [
      { itemName: 'Ready-Mix Concrete (M25)', quantity: 100, unit: 'cum', unitPrice: 5500 },
      { itemName: 'TMT Bars (16mm)', quantity: 3000, unit: 'kg', unitPrice: 65 },
      { itemName: 'Formwork Shuttering Plywood', quantity: 50, unit: 'sheets', unitPrice: 1500 },
    ]},
    { title: 'MIR-010: Glass and Aluminum Work', desc: 'Glass facade and aluminum framing', items: [
      { itemName: 'Toughened Glass (6mm)', quantity: 200, unit: 'sqm', unitPrice: 450 },
      { itemName: 'Aluminium Sections', quantity: 500, unit: 'running_m', unitPrice: 350 },
      { itemName: 'Silicon Sealant', quantity: 100, unit: 'tubes', unitPrice: 280 },
    ]},
    { title: 'MIR-011: Elevator Installation Materials', desc: 'Elevator shaft and installation parts', items: [
      { itemName: 'Guide Rails', quantity: 60, unit: 'meters', unitPrice: 1200 },
      { itemName: 'Elevator Door Panels', quantity: 8, unit: 'units', unitPrice: 25000 },
      { itemName: 'Control Panel', quantity: 2, unit: 'units', unitPrice: 45000 },
    ]},
    { title: 'MIR-012: Landscaping Materials', desc: 'Garden and landscape supplies', items: [
      { itemName: 'Topsoil', quantity: 50, unit: 'cum', unitPrice: 800 },
      { itemName: 'Grass Turf Rolls', quantity: 500, unit: 'sqm', unitPrice: 65 },
      { itemName: 'Garden Paving Stones', quantity: 200, unit: 'sqm', unitPrice: 280 },
    ]},
    { title: 'MIR-013: Waterproofing Materials', desc: 'Terrace and basement waterproofing', items: [
      { itemName: 'Bituminous Membrane', quantity: 300, unit: 'sqm', unitPrice: 180 },
      { itemName: 'Crystalline Admixture', quantity: 100, unit: 'kg', unitPrice: 350 },
      { itemName: 'Drainage Mats', quantity: 150, unit: 'sqm', unitPrice: 120 },
    ]},
    { title: 'MIR-014: Fire Fighting System', desc: 'Fire detection and suppression system', items: [
      { itemName: 'Fire Sprinkler Heads', quantity: 200, unit: 'units', unitPrice: 350 },
      { itemName: 'Fire Hose Reels', quantity: 20, unit: 'units', unitPrice: 4500 },
      { itemName: 'Smoke Detectors', quantity: 100, unit: 'units', unitPrice: 1800 },
    ]},
    { title: 'MIR-015: Septic Tank and Drainage', desc: 'Drainage system for residential complex', items: [
      { itemName: 'Septic Tank (2000L)', quantity: 10, unit: 'units', unitPrice: 25000 },
      { itemName: 'PVC Drain Pipes (6 inch)', quantity: 500, unit: 'meters', unitPrice: 120 },
      { itemName: 'Manhole Covers', quantity: 30, unit: 'units', unitPrice: 3500 },
    ]},
    { title: 'MIR-016: Solar Panel Installation', desc: 'Rooftop solar panel system', items: [
      { itemName: 'Solar Panels (400W)', quantity: 50, unit: 'units', unitPrice: 18000 },
      { itemName: 'Inverter (5kW)', quantity: 5, unit: 'units', unitPrice: 35000 },
      { itemName: 'Mounting Structure', quantity: 50, unit: 'sets', unitPrice: 2500 },
    ]},
    { title: 'MIR-017: Road and Pavement Work', desc: 'Internal roads and parking area', items: [
      { itemName: 'Paver Blocks', quantity: 1000, unit: 'sqm', unitPrice: 65 },
      { itemName: 'Road Base Aggregate', quantity: 200, unit: 'cum', unitPrice: 1200 },
      { itemName: 'Asphalt Mix', quantity: 100, unit: 'tonnes', unitPrice: 5500 },
    ]},
    { title: 'MIR-018: CCTV and Security System', desc: 'Surveillance and access control', items: [
      { itemName: 'CCTV Cameras (IP)', quantity: 30, unit: 'units', unitPrice: 8000 },
      { itemName: 'DVR System', quantity: 3, unit: 'units', unitPrice: 25000 },
      { itemName: 'Access Control Panels', quantity: 5, unit: 'units', unitPrice: 15000 },
    ]},
    { title: 'MIR-019: Ceiling and Partition Work', desc: 'False ceiling and office partitions', items: [
      { itemName: 'Gypsum Ceiling Tiles', quantity: 1000, unit: 'sqm', unitPrice: 120 },
      { itemName: 'Metal Framing Grid', quantity: 1000, unit: 'sqm', unitPrice: 85 },
      { itemName: 'Glass Partitions', quantity: 100, unit: 'sqm', unitPrice: 2800 },
    ]},
    { title: 'MIR-020: Generator and UPS', desc: 'Power backup for commercial building', items: [
      { itemName: 'Diesel Generator (250kVA)', quantity: 2, unit: 'units', unitPrice: 450000 },
      { itemName: 'UPS Systems (10kVA)', quantity: 5, unit: 'units', unitPrice: 65000 },
      { itemName: 'AMF Panel', quantity: 2, unit: 'units', unitPrice: 35000 },
    ]},
    { title: 'MIR-021: Welding Supplies', desc: 'Welding electrodes and accessories', items: [
      { itemName: 'Welding Electrodes (E6013)', quantity: 500, unit: 'kg', unitPrice: 120 },
      { itemName: 'Welding Wire (MIG)', quantity: 100, unit: 'kg', unitPrice: 250 },
      { itemName: 'Welding Machine', quantity: 3, unit: 'units', unitPrice: 18000 },
    ]},
    { title: 'MIR-022: Scaffolding Material', desc: 'Scaffolding for high-rise work', items: [
      { itemName: 'Steel Scaffolding Frames', quantity: 200, unit: 'sets', unitPrice: 3500 },
      { itemName: 'Cross Braces', quantity: 400, unit: 'units', unitPrice: 450 },
      { itemName: 'Base Jacks', quantity: 200, unit: 'units', unitPrice: 350 },
    ]},
    { title: 'MIR-023: Staircase and Railing', desc: 'Staircase fabrication materials', items: [
      { itemName: 'SS Handrail (Grade 304)', quantity: 200, unit: 'running_m', unitPrice: 1200 },
      { itemName: 'MS Channel for stringer', quantity: 500, unit: 'kg', unitPrice: 75 },
      { itemName: 'SS Balusters', quantity: 300, unit: 'units', unitPrice: 350 },
    ]},
    { title: 'MIR-024: Water Proofing Chemicals', desc: 'Chemical waterproofing for wet areas', items: [
      { itemName: 'Polyurethane Coating', quantity: 200, unit: 'liters', unitPrice: 450 },
      { itemName: 'Epoxy Grout', quantity: 100, unit: 'kg', unitPrice: 380 },
      { itemName: 'Crack Filler', quantity: 50, unit: 'kg', unitPrice: 220 },
    ]},
    { title: 'MIR-025: Doors and Windows Hardware', desc: 'Hardware for doors and windows', items: [
      { itemName: 'Door Locks (Cylindrical)', quantity: 200, unit: 'sets', unitPrice: 1500 },
      { itemName: 'Door Closers', quantity: 150, unit: 'units', unitPrice: 1200 },
      { itemName: 'Aluminium Sliding Windows', quantity: 100, unit: 'units', unitPrice: 5500 },
    ]},
  ]

  const mirStatuses: Array<'PENDING' | 'STOCK_MANAGER_APPROVED' | 'ADMIN_APPROVED' | 'REJECTED' | 'RETURNED' | 'ORDERED' | 'RECEIVED'> = [
    'PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING',
    'PENDING', 'PENDING',
    'STOCK_MANAGER_APPROVED', 'STOCK_MANAGER_APPROVED', 'STOCK_MANAGER_APPROVED',
    'ADMIN_APPROVED', 'ADMIN_APPROVED', 'ADMIN_APPROVED',
    'ORDERED', 'ORDERED', 'ORDERED',
    'RECEIVED', 'RECEIVED', 'RECEIVED',
    'REJECTED', 'REJECTED',
    'RETURNED', 'RETURNED',
  ]

  const mirPriorities = [Priority.LOW, Priority.MEDIUM, Priority.MEDIUM, Priority.HIGH, Priority.URGENT]

  let mirCount = 0
  for (let i = 0; i < 25; i++) {
    const mir = mirTitles[i]
    const site = pick(sites)
    const user = pick(users)
    const status = mirStatuses[i % mirStatuses.length]
    const priority = pick(mirPriorities)
    const daysBack = Math.floor(rand() * 60) + 1
    const createdAt = daysAgo(daysBack)
    const requiredDate = daysFromNow(Math.floor(rand() * 30) + 7)

    const totalAmount = mir.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)

    const mirData: any = {
      siteId: site.id,
      userId: user.id,
      title: mir.title,
      description: mir.desc,
      requiredDate,
      priority,
      status,
      totalAmount,
      createdAt,
    }

    if (status === 'STOCK_MANAGER_APPROVED' || status === 'ADMIN_APPROVED' || status === 'ORDERED' || status === 'RECEIVED') {
      mirData.stockManagerApprovedById = stockManager.id
      mirData.stockManagerApprovedAt = new Date(createdAt.getTime() + 86400000)
    }
    if (status === 'ADMIN_APPROVED' || status === 'ORDERED' || status === 'RECEIVED') {
      mirData.adminApprovedById = admin.id
      mirData.adminApprovedAt = new Date((mirData.stockManagerApprovedAt || createdAt).getTime() + 86400000)
    }
    if (status === 'ORDERED') {
      mirData.notes = 'Order placed with supplier. Expected delivery in 10 days.'
    }
    if (status === 'RECEIVED') {
      mirData.notes = 'Materials received and inspected. Quality verified.'
    }
    if (status === 'REJECTED') {
      const reasons = ['Budget exceeded for this quarter', 'Duplicate requisition', 'Items not in approved BOQ', 'Vendor not on approved list']
      mirData.rejectionReason = pick(reasons)
    }
    if (status === 'RETURNED') {
      const reasons = ['Please update quantities', 'Missing unit prices', 'Wrong priority level', 'Please add specifications']
      mirData.returnReason = pick(reasons)
    }

    await db.requisition.create({
      data: {
        ...mirData,
        boqItems: {
          create: mir.items.map(item => ({
            itemName: item.itemName,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
          })),
        },
      },
    })
    mirCount++
  }

  console.log('Database seeded successfully!')
  console.log(`Users: ${6}, Clients: 3, Sites: 6, Categories: 8`)
  console.log(`Expenses: ${expenseCount}, Requisitions: ${mirCount}`)
}

main().catch(console.error).finally(() => db.$disconnect())
