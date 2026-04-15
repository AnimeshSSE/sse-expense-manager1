import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const databaseUrl =
    process.env.TURSO_DATABASE_URL ??
    process.env.DATABASE_URL
  const authToken =
    process.env.TURSO_AUTH_TOKEN ??
    process.env.DATABASE_AUTH_TOKEN

  if (process.env.NODE_ENV === 'production' && !databaseUrl) {
    throw new Error(
      'Missing database configuration. Set TURSO_DATABASE_URL or DATABASE_URL in Vercel project settings.'
    )
  }

  if (!databaseUrl?.startsWith('libsql://')) {
    return new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query'] : [],
    })
  }

  const adapter = new PrismaLibSQL({
    url: databaseUrl,
    authToken,
  })

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
