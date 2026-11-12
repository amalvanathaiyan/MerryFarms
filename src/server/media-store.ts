import "server-only"
import { createHmac } from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"
import { createServiceClient } from "@/lib/supabase/server"
import { isDemoLoginEnabled } from "@/lib/demo-auth"
import { OrderError } from "./orders"

/**
 * Where farm videos and photos (product pictures, logos) are kept. Live: Supabase storage (public bucket "farm-media"); the phone uploads straight to it
 * with a signed link, because a video is too big to pass through the app's own server. Demo: a local folder served
 * by /api/demo-media (never in production). Anywhere else, uploads are off.
 */
export const MEDIA_BUCKET = "farm-media"

const supabaseOn = () => !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
const localOn = () => !supabaseOn() && (isDemoLoginEnabled() || !!process.env.MEDIA_DIR_FOR_TESTS)
export const localDir = () => process.env.MEDIA_DIR_FOR_TESTS || path.join(process.cwd(), ".demo-media")
export const mediaAvailable = () => supabaseOn() || localOn()

/** Videos the phone uploads itself: tenant/videos/name.ext. */
export const VIDEO_PATH = /^[\w-]+\/videos\/[\w-]+\.(mp4|mov|webm|jpg)$/
/** Photos the app's server writes, already checked and shrunk: tenant/images|logo/name.ext. */
export const IMAGE_PATH = /^[\w-]+\/(images|logo)\/[\w-]+\.(webp|jpg|png)$/
/** Only these names are ever written, served or removed. */
export const SAFE_PATH = { test: (p: string) => VIDEO_PATH.test(p) || IMAGE_PATH.test(p) }
// The bucket's per-file limit: 50 MB is the most the Supabase free plan allows (asking for more fails to create the
// bucket); the app's own videos stop at 40 MB (MAX_UPLOAD_BYTES).
const ALLOWED_TYPES = ["video/mp4", "video/quicktime", "video/webm", "image/jpeg", "image/webp", "image/png"]

let bucketReady = false
async function ensureBucket() {
  if (bucketReady) return
  const storage = createServiceClient().storage
  const { data } = await storage.getBucket(MEDIA_BUCKET)
  if (!data) {
    const { error } = await storage.createBucket(MEDIA_BUCKET, { public: true, fileSizeLimit: "50MB", allowedMimeTypes: ALLOWED_TYPES })
    if (error && !/exist/i.test(error.message)) throw new Error(`[media] bucket: ${error.message}`)
  } else if (ALLOWED_TYPES.some((t) => !(data.allowed_mime_types ?? ALLOWED_TYPES).includes(t))) {
    // A bucket made before photos moved here took only videos and JPEG: let it take WebP and PNG photos too.
    const { error } = await storage.updateBucket(MEDIA_BUCKET, { public: true, fileSizeLimit: "50MB", allowedMimeTypes: ALLOWED_TYPES })
    if (error) throw new Error(`[media] bucket update: ${error.message}`)
  }
  bucketReady = true
}

const sign = (p: string) =>
  createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY || "demo-media-only").update(p).digest("hex").slice(0, 32)
export const validLocalSignature = (p: string, sig: string | null) => !!sig && sign(p) === sig

export type UploadTarget = { kind: "supabase"; path: string; token: string } | { kind: "local"; path: string; url: string }

/** A one-time place for the phone to put a file. */
export async function uploadTarget(p: string): Promise<UploadTarget> {
  if (!VIDEO_PATH.test(p)) throw new OrderError("invalid_form")
  if (supabaseOn()) {
    await ensureBucket()
    const { data, error } = await createServiceClient().storage.from(MEDIA_BUCKET).createSignedUploadUrl(p)
    if (error || !data) throw new Error(`[media] signed upload: ${error?.message}`)
    return { kind: "supabase", path: data.path, token: data.token }
  }
  if (localOn()) return { kind: "local", path: p, url: `/api/demo-media?path=${encodeURIComponent(p)}&sig=${sign(p)}` }
  throw new OrderError("media_off")
}

/** Writes a photo the server has already checked (type sniffed, size limited). */
export async function putFile(p: string, bytes: Uint8Array, mime: string) {
  if (!IMAGE_PATH.test(p)) throw new OrderError("invalid_form")
  if (supabaseOn()) {
    await ensureBucket()
    const { error } = await createServiceClient().storage.from(MEDIA_BUCKET).upload(p, bytes, { contentType: mime, upsert: true })
    if (error) throw new Error(`[media] upload: ${error.message}`)
    return
  }
  if (!localOn()) throw new OrderError("media_off")
  const file = path.join(localDir(), p)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, bytes)
}

/** A stored file's bytes, for the server's own use (e.g. making app icons from a logo); null if it isn't there. */
export async function readFile(p: string): Promise<Uint8Array | null> {
  if (!SAFE_PATH.test(p)) return null
  try {
    if (supabaseOn()) {
      const { data } = await createServiceClient().storage.from(MEDIA_BUCKET).download(p)
      return data ? new Uint8Array(await data.arrayBuffer()) : null
    }
    return new Uint8Array(await fs.readFile(path.join(localDir(), p)))
  } catch {
    return null
  }
}

/** The address anyone can play the file from. */
export function publicUrl(p: string): string {
  if (supabaseOn()) return createServiceClient().storage.from(MEDIA_BUCKET).getPublicUrl(p).data.publicUrl
  return `/api/demo-media?path=${encodeURIComponent(p)}`
}

/** The stored file's size in bytes, or null when it isn't there (the upload didn't finish). */
export async function storedSize(p: string): Promise<number | null> {
  if (supabaseOn()) {
    const dir = p.slice(0, p.lastIndexOf("/"))
    const name = p.slice(p.lastIndexOf("/") + 1)
    const { data } = await createServiceClient().storage.from(MEDIA_BUCKET).list(dir, { search: name, limit: 5 })
    const f = data?.find((x) => x.name === name)
    return f ? Number((f.metadata as { size?: number } | null)?.size ?? 0) : null
  }
  try {
    return (await fs.stat(path.join(localDir(), p))).size
  } catch {
    return null
  }
}

/** Removes files (never fails the caller: a leftover file is only wasted space). */
export async function removeStored(paths: string[]) {
  const list = paths.filter((p) => SAFE_PATH.test(p))
  if (!list.length) return
  try {
    if (supabaseOn()) await createServiceClient().storage.from(MEDIA_BUCKET).remove(list)
    else await Promise.all(list.map((p) => fs.rm(path.join(localDir(), p), { force: true })))
  } catch (e) {
    console.error("[media] remove:", (e as Error).message)
  }
}
