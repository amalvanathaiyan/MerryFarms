import path from "node:path"
import { defineConfig } from "prisma/config"
import { config } from "dotenv"

// Load .env.local so Prisma CLI picks up the DB credentials
// (Next.js loads .env.local automatically but Prisma CLI does not)
config({ path: ".env.local", quiet: true })

// Prisma 7 — connection URLs live here, not in schema.prisma.
// The CLI (db push, migrate) needs the direct connection (port 5432);
// the app uses DATABASE_URL (Supabase pooler, port 6543) via src/lib/prisma.ts.
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
})
