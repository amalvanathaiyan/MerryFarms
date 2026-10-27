import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

// Prisma 7 — connection URL passed via pg adapter, not in schema.prisma
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL!,
  })
  // Supabase's pooler closes idle connections. Without a listener, that error
  // would crash the whole process; the pool replaces the connection on its own.
  pool.on("error", (err) => console.error("[db] idle connection closed:", err.message))
  const adapter = new PrismaPg(pool)
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })
}

// Prevent multiple instances in development (Next.js hot reload)
export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
