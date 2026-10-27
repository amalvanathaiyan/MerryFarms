/**
 * Applies the SQL generated from schema.prisma, plus rls.sql, to an in-process
 * Postgres (PGlite) and checks the guarantees the app relies on.
 * Regenerate the SQL after schema changes: npm run db:sql > prisma/sql/schema.generated.sql
 */
import { readFileSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { beforeAll, describe, expect, it } from "vitest"

const sql = (f: string) => readFileSync(path.join(__dirname, "sql", f), "utf8")
let db: PGlite

beforeAll(async () => {
  db = new PGlite()
  // Supabase's API roles, so rls.sql has something to lock out.
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
                 GRANT USAGE ON SCHEMA public TO anon, authenticated;`)
  await db.exec(sql("schema.generated.sql"))
  await db.exec(`GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO anon, authenticated;`) // simulate Supabase defaults
  await db.exec(sql("rls.sql"))
  await db.exec(`
    INSERT INTO tenants (id, slug, "nameTa", "nameEn", phone, "updatedAt")
    VALUES ('t1', 'merryfarms', 'மெர்ரி ஃபார்ம்ஸ்', 'Merry Farms', '+919000020001', now()),
           ('t2', 'kaveri', 'காவேரி', 'Kaveri Dairy', '+919000030001', now());`)
}, 60_000)

describe("database schema", () => {
  it("lets the app (table owner) read and write", async () => {
    const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM tenants`)
    expect(r.rows[0].n).toBe(2)
  })

  it("enables row-level security on every table", async () => {
    const r = await db.query<{ tablename: string }>(
      `SELECT c.relname AS tablename FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity`
    )
    expect(r.rows).toEqual([])
  })

  it("gives the public API roles no access", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`SET ROLE ${role}`)
      await expect(db.query(`SELECT * FROM customers`)).rejects.toThrow(/permission denied/)
      await db.exec(`RESET ROLE`)
    }
  })

  it("keeps the same phone separate per farm but unique within a farm", async () => {
    await db.exec(`INSERT INTO customers (id, "tenantId", phone, name) VALUES
      ('c1', 't1', '+919000010001', 'Priya'), ('c2', 't2', '+919000010001', 'Priya')`)
    await expect(
      db.exec(`INSERT INTO customers (id, "tenantId", phone, name) VALUES ('c3', 't1', '+919000010001', 'Dup')`)
    ).rejects.toThrow(/unique/i)
  })

  it("keeps order numbers unique per farm", async () => {
    const insert = (id: string, tenant: string, cust: string) =>
      db.exec(`INSERT INTO orders (id, "tenantId", number, "customerId", channel, "slotDate", "slotLabel",
                 "paymentMethod", "subtotalPaise", "deliveryFeePaise", "totalPaise", "updatedAt")
               VALUES ('${id}', '${tenant}', 1001, '${cust}', 'whatsapp', '2026-10-22', '7–9 AM',
                 'upi_on_delivery', 39000, 0, 39000, now())`)
    await insert("o1", "t1", "c1")
    await insert("o2", "t2", "c2")
    await expect(insert("o3", "t1", "c1")).rejects.toThrow(/unique/i)
  })
})
