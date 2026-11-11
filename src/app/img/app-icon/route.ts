import sharp from "sharp"
import { getTenant } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"

/**
 * The shop app's home-screen icon, made from this farm's own logo (Settings → Look). Farms without a logo
 * keep the cream FarmForYou icon in public/icons; the manifest and page only link here once a logo exists.
 *   ?size=180|192|512   180 is the iPhone icon, 192 and 512 are Android's
 *   ?maskable=1         Android crops these to a circle or squircle: the logo sits inside the middle 80%
 * The space around the logo takes the colour of its corner, so it looks like part of the logo.
 * Links carry ?v=<time of logo upload>, so phones may keep it long.
 */
const SIZES = new Set([180, 192, 512])

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const size = Number(params.get("size"))
  if (!SIZES.has(size)) return new Response("Unknown size", { status: 400 })
  const maskable = params.get("maskable") === "1"

  const tenant = await getTenant()
  const logo = tenant ? await prisma.tenantLogo.findUnique({ where: { tenantId: tenant.id } }) : null
  if (!logo) return new Response("Not found", { status: 404 })

  const { data: corner } = await sharp(logo.data).flatten({ background: "#ffffff" }).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true })
  const background = { r: corner[0], g: corner[1], b: corner[2] }
  const inner = maskable ? Math.round(size * 0.8) : size
  const art = await sharp(logo.data).flatten({ background }).resize(inner, inner, { fit: "contain", background }).toBuffer()
  const pad = (size - inner) / 2
  const png = await sharp(art)
    .extend({ top: Math.floor(pad), bottom: Math.ceil(pad), left: Math.floor(pad), right: Math.ceil(pad), background })
    .png()
    .toBuffer()

  return new Response(new Uint8Array(png), {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" },
  })
}
