// Runs a .sql file against the database in .env.local (direct connection).
// Usage: node scripts/apply-sql.mjs prisma/sql/rls.sql
import { readFileSync } from "node:fs"
import { config } from "dotenv"
import pg from "pg"

config({ path: ".env.local", quiet: true })
const file = process.argv[2]
if (!file) {
  console.error("Usage: node scripts/apply-sql.mjs <file.sql>")
  process.exit(1)
}
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL
if (!url) {
  console.error("Set DIRECT_URL (or DATABASE_URL) in .env.local first.")
  process.exit(1)
}

const client = new pg.Client({ connectionString: url })
await client.connect()
try {
  await client.query(readFileSync(file, "utf8"))
  console.log(`Applied ${file}`)
} finally {
  await client.end()
}
