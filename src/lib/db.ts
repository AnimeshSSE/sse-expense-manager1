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

  // Use libsql adapter for Turso (libsql:// or https://)
  if (databaseUrl.startsWith('libsql://') || databaseUrl.startsWith('https://')) {
    const adapter = new PrismaLibSql({
      url: databaseUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
    return new PrismaClient({ adapter })
  }

  // Local SQLite (file:)
  if (databaseUrl.startsWith('file:')) {
    return new PrismaClient()
  }

  // Fallback
  return new PrismaClient()
}

export const db =
  globalForPrisma.prisma ??
  createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
