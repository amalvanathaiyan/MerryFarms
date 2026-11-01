import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

// Prisma 7 — connection URL passed via pg adapter, not in schema.prisma
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  const url = process.env.DATABASE_URL!
  const pool = new Pool({
    connectionString: url,
    // Each Vercel function holds its own pool; a few connections each keeps the Supabase pooler from filling up.
    max: process.env.VERCEL ? 3 : undefined,
    // Encrypt traffic to Supabase. Its certificate comes from its own authority, so the chain can't be verified here.
    ssl: url.includes(".supabase.") ? { rejectUnauthorized: false } : undefined,
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
