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

  // A logo with a see-through background (a mark, like the Merry Egg) is measured and set straight on the app's colour;
  // a logo drawn on its own background keeps that background.
  const mark = await transparentMark(logo.data)
  const png = mark
    ? await onColour(mark, size, maskable, farmApp ? APP_COLOURS.farm : APP_COLOURS.shop)
    : farmApp
      ? await onGreen(logo.data, size, maskable)
      : await filled(logo.data, size, maskable)
  return new Response(new Uint8Array(png), {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" },
  })
}

type Mark = { data: Uint8Array; box: { left: number; top: number; width: number; height: number }; reach: number }

/** The drawn part of a logo with a see-through background: its box, and how far its farthest pixel is from the box's centre. */
async function transparentMark(data: Uint8Array): Promise<Mark | null> {
  const { data: px, info } = await sharp(data).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  const alpha = (x: number, y: number) => px[(y * w + x) * 4 + 3]
  if (alpha(0, 0) > 16 || alpha(w - 1, 0) > 16 || alpha(0, h - 1) > 16) return null
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (alpha(x, y) > 24) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
  if (x1 < 0) return null
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  let reach = 0
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (alpha(x, y) > 24) reach = Math.max(reach, Math.hypot(x - cx, y - cy))
  return { data, box: { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }, reach }
}

/**
 * A mark on the app's colour, filling the icon: 84% of a square icon; when maskable, its farthest pixel at 40% of the
 * size from the centre, so Android's round crop (which keeps the middle 80%) shows all of it, as large as it can be.
 */
async function onColour(mark: Mark, size: number, maskable: boolean, colour: string) {
  const { box } = mark
  const scale = maskable ? (0.4 * size) / mark.reach : Math.min((0.84 * size) / box.width, (0.84 * size) / box.height)
  const width = Math.max(1, Math.round(box.width * scale)), height = Math.max(1, Math.round(box.height * scale))
  const art = await sharp(mark.data).extract(box).resize(width, height).png().toBuffer()
  return sharp({ create: { width: size, height: size, channels: 4, background: colour } })
    .composite([{ input: art, left: Math.round((size - width) / 2), top: Math.round((size - height) / 2) }])
    .flatten({ background: colour })
    .png()
    .toBuffer()
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

/** The farm app, for a logo with its own background: the logo in a rounded square on green. Maskable keeps the whole square inside Android's circle. */
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
