import { ImageResponse } from "next/og"
import sharp from "sharp"
import { getTenant } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import { photoBytes } from "@/server/photos"

/**
 * The link preview (1200×630) WhatsApp and Facebook show when a shop link is shared: the farm's own logo
 * and name, for whichever farm the address is for. WhatsApp often crops it to a square from the middle,
 * so everything sits in one centred column. The name is in English: the image renderer can't join Tamil
 * letters correctly, and the preview's title line under the picture carries the Tamil name.
 */
const FIELD = "#FBF3DC", INK = "#16301F", LEAF = "#1E6B45", CREAM = "#FFF1C7"

export async function GET(request: Request) {
  // ?ffy=1: Farm For You's own pages (home, Register your farm), whatever farm the address defaults to
  const tenant = new URL(request.url).searchParams.get("ffy") ? null : await getTenant()
  const name = tenant?.nameEn ?? "Farm For You"
  const row = tenant ? await prisma.tenantLogo.findUnique({ where: { tenantId: tenant.id } }) : null
  const logo = row ? await photoBytes(row) : null
  // The logo is usually WebP (shrunk on the phone); the renderer wants PNG.
  const logoSrc = logo ? `data:image/png;base64,${(await sharp(logo).png().toBuffer()).toString("base64")}` : null

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: FIELD }}>
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- rendered to a PNG, not a page
          <img src={logoSrc} alt="" width={360} height={360} style={{ borderRadius: 48, border: `3px solid ${INK}22`, background: "#fff", objectFit: "contain" }} />
        ) : (
          <div style={{ width: 300, height: 300, borderRadius: 48, background: LEAF, color: CREAM, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 110 }}>
            {tenant?.invoicePrefix ?? "FFY"}
          </div>
        )}
        <div style={{ marginTop: 28, fontSize: 68, color: INK, textAlign: "center", maxWidth: 1080, lineHeight: 1.1 }}>{name}</div>
        <div style={{ marginTop: 12, fontSize: 30, color: LEAF }}>Fresh from the farm · Farm For You</div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "cache-control": "public, max-age=86400" } },
  )
}
