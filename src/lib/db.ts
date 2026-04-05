import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

// Singleton pattern for PrismaClient
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createDb(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL || ''

  // If using Turso (libsql:// URL), use the libSQL adapter
  if (dbUrl.startsWith('libsql://')) {
    const adapter = new PrismaLibSQL({
      url: dbUrl,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    })

    return new PrismaClient({ adapter, log: ['error'] })
  }

  // Local SQLite development (file: URL)
  return new PrismaClient({ log: ['error'] })
}

export const db = globalForPrisma.prisma ?? createDb()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
