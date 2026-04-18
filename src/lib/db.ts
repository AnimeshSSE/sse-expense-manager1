import { PrismaClient } from '@prisma/client'

// Singleton pattern for PrismaClient
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createDb(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL || ''
  const authToken = process.env.DATABASE_AUTH_TOKEN || ''

  // If using Turso (libsql:// URL), use the libSQL adapter
  if (dbUrl.startsWith('libsql://')) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaLibSQL } = require('@prisma/adapter-libsql')

    const adapter = new PrismaLibSQL({
      url: dbUrl,
      authToken: authToken,
    })

    return new PrismaClient({ adapter, log: ['error'] })
  }

  // Local SQLite development (file: URL)
  return new PrismaClient({ log: ['error'] })
}

export const db: PrismaClient = globalForPrisma.prisma ?? createDb()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
