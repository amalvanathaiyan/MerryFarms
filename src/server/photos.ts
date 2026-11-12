import "server-only"
import { mediaAvailable, publicUrl, putFile, readFile, removeStored } from "./media-store"

/**
 * Product photos and farm logos. New ones go to file storage (Supabase storage live, a local folder in the demo), so
 * the database stays small (500 MB on the free plan). Older ones still in the database keep working until
 * scripts/move-photos-to-storage.mts moves them. Where file storage isn't set up (tests), photos stay in the database.
 */
export type StoredPhoto = { data: Uint8Array | null; storagePath: string | null; mime: string }

const EXT: Record<string, string> = { "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg" }

/** Saves a checked photo; a fresh name each time, so phones never show an old copy. */
export async function storePhoto(
  tenantId: string,
  folder: "images" | "logo",
  name: string,
  bytes: Uint8Array<ArrayBuffer>,
  mime: string,
): Promise<{ data: Uint8Array<ArrayBuffer> | null; storagePath: string | null }> {
  if (!mediaAvailable()) return { data: bytes, storagePath: null }
  const storagePath = `${tenantId}/${folder}/${name}-${Date.now()}.${EXT[mime] ?? "jpg"}`
  await putFile(storagePath, bytes, mime)
  return { data: null, storagePath }
}

/** Removes the old file once a photo is replaced or removed. */
export async function dropPhoto(row: { storagePath: string | null } | null | undefined) {
  if (row?.storagePath) await removeStored([row.storagePath])
}

/** The photo's bytes, wherever it is. */
export async function photoBytes(row: StoredPhoto): Promise<Uint8Array | null> {
  if (row.data) return new Uint8Array(row.data)
  return row.storagePath ? readFile(row.storagePath) : null
}

const CACHE = { "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" }

/** The answer for the app's photo links (/img/...): a redirect to the stored file, or the bytes from the database. */
export function photoResponse(row: StoredPhoto): Response {
  if (row.storagePath) return new Response(null, { status: 302, headers: { location: publicUrl(row.storagePath), ...CACHE } })
  if (!row.data) return new Response("Not found", { status: 404 })
  return new Response(new Uint8Array(row.data), { headers: { "content-type": row.mime, ...CACHE } })
}
