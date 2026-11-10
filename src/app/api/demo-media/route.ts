import { promises as fs } from "node:fs"
import path from "node:path"
import { NextResponse } from "next/server"
import { isDemoLoginEnabled } from "@/lib/demo-auth"
import { localDir, SAFE_PATH, validLocalSignature } from "@/server/media-store"

/**
 * Demo mode only (npm run demo): stands in for Supabase storage, so farm videos can be tried without it.
 * PUT stores a file at a signed path (the signature comes from the app); GET plays it back, with byte ranges for
 * phones. Off in production and whenever Supabase is set up.
 */
const off = () => process.env.NODE_ENV === "production" || !isDemoLoginEnabled() || !!process.env.SUPABASE_SERVICE_ROLE_KEY
const TYPES: Record<string, string> = { mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", jpg: "image/jpeg" }
const MAX = 60 * 1024 * 1024

function target(url: URL) {
  const p = url.searchParams.get("path") ?? ""
  return SAFE_PATH.test(p) ? p : null
}

export async function PUT(request: Request) {
  const url = new URL(request.url)
  const p = target(url)
  if (off() || !p || !validLocalSignature(p, url.searchParams.get("sig"))) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  const body = Buffer.from(await request.arrayBuffer())
  if (body.length === 0 || body.length > MAX) return NextResponse.json({ error: "size" }, { status: 413 })
  const file = path.join(localDir(), p)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, body)
  return NextResponse.json({ ok: true })
}

export async function GET(request: Request) {
  const p = target(new URL(request.url))
  if (off() || !p) return new NextResponse(null, { status: 404 })
  let data: Buffer
  try {
    data = await fs.readFile(path.join(localDir(), p))
  } catch {
    return new NextResponse(null, { status: 404 })
  }
  const type = TYPES[p.split(".").pop()!] ?? "application/octet-stream"
  const range = request.headers.get("range")?.match(/bytes=(\d*)-(\d*)/)
  if (range) {
    const start = range[1] ? Number(range[1]) : 0
    const end = range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1
    if (start >= data.length || start > end) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${data.length}` } })
    return new NextResponse(new Uint8Array(data.subarray(start, end + 1)), {
      status: 206,
      headers: { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${data.length}`, "Accept-Ranges": "bytes", "Content-Length": String(end - start + 1) },
    })
  }
  return new NextResponse(new Uint8Array(data), { headers: { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": String(data.length) } })
}
