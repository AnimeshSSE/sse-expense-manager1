import { PrismaClient } from '@prisma/client'

// Singleton pattern for PrismaClient
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL

  // Use pg adapter for PostgreSQL (Vercel Postgres / Neon)
  if (databaseUrl && (databaseUrl.startsWith('postgres') || databaseUrl.startsWith('postgresql'))) {
    // Dynamic imports to avoid bundling pg when using SQLite locally
    const { Pool } = require('pg')
    const { PrismaPg } = require('@prisma/adapter-pg')

    // For Vercel Postgres, use the non-pooled direct URL for the adapter
    const directUrl = process.env.DIRECT_URL || databaseUrl
    const pool = new Pool({ connectionString: directUrl })
    const adapter = new PrismaPg(pool)

    return new PrismaClient({ adapter })
  }

  return new PrismaClient()
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
