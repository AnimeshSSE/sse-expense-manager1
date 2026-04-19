import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createDb(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL || ''

  if (dbUrl.startsWith('libsql://')) {
    // Dynamic import for Turso/libsql adapter
    // These are in serverExternalPackages so they won't be bundled
    let PrismaLibSQL: any
    let createClient: any

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const adapterMod = require('@prisma/adapter-libsql')
      PrismaLibSQL = adapterMod.PrismaLibSQL || adapterMod.default || adapterMod
    } catch (e) {
      throw new Error(
        `Failed to load @prisma/adapter-libsql. Ensure it is installed. Error: ${e instanceof Error ? e.message : String(e)}`
      )
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const libsqlMod = require('@libsql/client')
      createClient = libsqlMod.createClient || libsqlMod.default?.createClient
    } catch (e) {
      throw new Error(
        `Failed to load @libsql/client. Ensure it is installed. Error: ${e instanceof Error ? e.message : String(e)}`
      )
    }

    const libsql = createClient({
      url: dbUrl,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    })

    const adapter = new PrismaLibSQL(libsql)
    return new PrismaClient({ adapter, log: ['error'] })
  }

  return new PrismaClient({ log: ['error'] })
}

export const db = globalForPrisma.prisma ?? createDb()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
