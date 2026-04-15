import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  // Use libsql adapter for Turso (libsql://) or local SQLite (file:) URLs
  if (databaseUrl.startsWith('libsql://') || databaseUrl.startsWith('file:')) {
    const adapter = new PrismaLibSql({ url: databaseUrl })
    return new PrismaClient({ adapter })
  }

  // Fallback: standard PrismaClient without adapter
  return new PrismaClient()
}

export const db =
  globalForPrisma.prisma ??
  createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
