import sharp from "sharp"
import { getTenant } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { APP_COLOURS } from "@/domain/install-apps"

/**
 * The shop and farm apps' home-screen icons, made from this farm's own logo (Settings → Look). Farms without a
 * logo keep the fixed FarmForYou icons in public/icons; the manifests and pages only link here once a logo exists.
 *   ?size=180|192|512   180 is the iPhone icon, 192 and 512 are Android's
 *   ?maskable=1         Android crops these to a circle or squircle: the logo stays inside the middle 80%
 *   ?app=farm           the farm app: the logo in a rounded square on the farm app's green, so a phone holding
 *                       both apps tells them apart. The shop's logo fills its icon, padded in its corner colour.
 * Links carry ?v=<time of logo upload>, so phones may keep it long.
 */
const SIZES = new Set([180, 192, 512])

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const size = Number(params.get("size"))
  if (!SIZES.has(size)) return new Response("Unknown size", { status: 400 })
  const maskable = params.get("maskable") === "1"
  const farmApp = params.get("app") === "farm"

  const tenant = await getTenant()
  const logo = tenant ? await prisma.tenantLogo.findUnique({ where: { tenantId: tenant.id } }) : null
  if (!logo) return new Response("Not found", { status: 404 })

  const png = farmApp ? await onGreen(logo.data, size, maskable) : await filled(logo.data, size, maskable)
  return new Response(new Uint8Array(png), {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" },
  })
}

/** The shop: the logo fills the icon (the middle 80% when maskable), the rest in the colour of its corner. */
async function filled(data: Uint8Array, size: number, maskable: boolean) {
  const { data: corner } = await sharp(data).flatten({ background: "#ffffff" }).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true })
  const background = { r: corner[0], g: corner[1], b: corner[2] }
  const inner = maskable ? Math.round(size * 0.8) : size
  const art = await sharp(data).flatten({ background }).resize(inner, inner, { fit: "contain", background }).toBuffer()
  const pad = (size - inner) / 2
  return sharp(art)
    .extend({ top: Math.floor(pad), bottom: Math.ceil(pad), left: Math.floor(pad), right: Math.ceil(pad), background })
    .png()
    .toBuffer()
}

/** The farm app: the logo in a rounded square on green. Maskable keeps the whole square inside Android's circle. */
async function onGreen(data: Uint8Array, size: number, maskable: boolean) {
  const inner = Math.round(size * (maskable ? 0.6 : 0.76))
  const radius = Math.round(inner * 0.2)
  const corners = Buffer.from(`<svg width="${inner}" height="${inner}"><rect width="${inner}" height="${inner}" rx="${radius}" ry="${radius}"/></svg>`)
  const art = await sharp(data)
    .flatten({ background: "#ffffff" })
    .resize(inner, inner, { fit: "contain", background: "#ffffff" })
    .composite([{ input: corners, blend: "dest-in" }])
    .png()
    .toBuffer()
  const offset = Math.round((size - inner) / 2)
  return sharp({ create: { width: size, height: size, channels: 4, background: APP_COLOURS.farm } })
    .composite([{ input: art, left: offset, top: offset }])
    .png()
    .toBuffer()
}
