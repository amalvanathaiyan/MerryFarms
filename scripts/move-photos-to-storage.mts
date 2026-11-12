/**
 * Moves product photos and farm logos still kept in the database into file storage (Supabase storage), so the
 * database stays small. Safe to run more than once: only rows with bytes and no stored file are moved, and a row's
 * bytes are cleared only after its file is stored.
 *
 *   npx tsx scripts/move-photos-to-storage.mts            shows what it would move (nothing changes)
 *   npx tsx scripts/move-photos-to-storage.mts --apply    moves them
 *
 * Uses .env.local (DATABASE_URL and the Supabase keys).
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

const apply = process.argv.includes("--apply")
const { prisma } = await import("../src/lib/prisma.ts")
const { putFile, mediaAvailable } = await import("../src/server/media-store.ts")
if (!mediaAvailable()) throw new Error("File storage isn't set up (NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).")

const EXT: Record<string, string> = { "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg" }
const stamp = Date.now()

const products = await prisma.productImage.findMany({ where: { storagePath: null, NOT: { data: null } }, select: { productId: true, tenantId: true, mime: true, data: true } })
const logos = await prisma.tenantLogo.findMany({ where: { storagePath: null, NOT: { data: null } }, select: { tenantId: true, mime: true, data: true } })
const bytes = (rows: { data: Uint8Array | null }[]) => rows.reduce((n, r) => n + (r.data?.length ?? 0), 0)
console.log(`${products.length} product photos (${Math.round(bytes(products) / 1024)} KB), ${logos.length} logos (${Math.round(bytes(logos) / 1024)} KB) to move.`)
if (!apply) {
  console.log("Nothing changed. Run again with --apply to move them.")
  process.exit(0)
}

for (const p of products) {
  const path = `${p.tenantId}/images/${p.productId}-${stamp}.${EXT[p.mime] ?? "jpg"}`
  await putFile(path, new Uint8Array(p.data!), p.mime)
  await prisma.productImage.update({ where: { productId: p.productId }, data: { storagePath: path, data: null } })
  console.log("moved product photo", p.productId)
}
for (const l of logos) {
  const path = `${l.tenantId}/logo/logo-${stamp}.${EXT[l.mime] ?? "jpg"}`
  await putFile(path, new Uint8Array(l.data!), l.mime)
  await prisma.tenantLogo.update({ where: { tenantId: l.tenantId }, data: { storagePath: path, data: null } })
  console.log("moved logo", l.tenantId)
}
console.log("Done.")
await prisma.$disconnect()
