// One command to try the whole app locally: npm run demo
//
// 1. Starts a fresh local Postgres (PGlite, data in .pglite-demo/, wiped each run)
// 2. Seeds Merry Farms with demo staff, customers and orders
// 3. Starts the app with demo sign-in enabled (development only)
//
// Then open http://localhost:3000 (shop) and http://localhost:3000/login (farm app).
import { rmSync, readFileSync } from "node:fs"
import { spawn } from "node:child_process"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"

const DB_PORT = 5434
const APP_PORT = process.env.PORT ?? "3000"
const DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${DB_PORT}/postgres?sslmode=disable`

rmSync(".pglite-demo", { recursive: true, force: true })
const db = new PGlite(".pglite-demo")
await db.waitReady
await db.exec(readFileSync("prisma/sql/schema.generated.sql", "utf8"))
const server = new PGLiteSocketServer({ db, port: DB_PORT, host: "127.0.0.1", maxConnections: 10 })
await server.start()
console.log("✓ Local database started")

const env = {
  ...process.env,
  DATABASE_URL,
  DIRECT_URL: DATABASE_URL,
  DEFAULT_TENANT_SLUG: "merryfarms",
  DEMO_LOGIN: "1",
  // No Supabase in demo mode: staff use the demo sign-in buttons.
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
}

const run = (cmd, args) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { env, stdio: "inherit", shell: true })
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`))))
  })

await run("npx", ["tsx", "prisma/seed.ts", "--demo"])
console.log("✓ Demo data added\n")
console.log(`  Customer shop:  http://localhost:${APP_PORT}`)
console.log(`  Farm app:       http://localhost:${APP_PORT}/login  (use a demo sign-in button)\n`)

const app = spawn("npx", ["next", "dev", "-p", APP_PORT], { env, stdio: "inherit", shell: true })

const stop = async () => {
  app.kill()
  await server.stop()
  await db.close()
  process.exit(0)
}
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
app.on("exit", stop)
