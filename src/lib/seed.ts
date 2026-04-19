import { db } from './db'
import { hashPassword } from './auth'

let seeded = false

export async function ensureSeeded() {
  if (seeded) return
  try {
    const count = await db.user.count()
    if (count === 0) {
      const adminPassword = await hashPassword('admin123')
      await db.user.create({
        data: {
          email: 'admin@sslectricals.com',
          password: adminPassword,
          name: 'Admin',
          role: 'ADMIN',
          isActive: true,
        },
      })
      console.log('✅ Seeded default admin user')
    }
    seeded = true
  } catch (error) {
    console.error('Seed error:', error)
  }
}
