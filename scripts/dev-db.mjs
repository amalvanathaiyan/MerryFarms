// Local Postgres for development, no Docker or Supabase needed (PGlite over a socket).
// Data is kept in .pglite/ between runs.
//
//   npm run dev:db        then, in another terminal:
//   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/postgres?sslmode=disable npm run db:seed
//
// The schema is applied automatically the first time.
import { existsSync, readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"

const PORT = Number(process.env.DEV_DB_PORT ?? 5433)
const fresh = !existsSync(".pglite")
const db = new PGlite(".pglite")
await db.waitReady

if (fresh) {
  await db.exec(readFileSync("prisma/sql/schema.generated.sql", "utf8"))
  console.log("Created the database schema.")
}

const server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1", maxConnections: 10 })
await server.start()
console.log(`Local database ready: postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`)

const stop = async () => {
  await server.stop()
  await db.close()
  process.exit(0)
}
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
