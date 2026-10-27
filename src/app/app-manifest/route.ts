import { getTenant } from "@/lib/tenant"

/**
 * The install manifest, per farm: a customer who adds the shop to their Home Screen gets
 * the farm's own name, not the platform's.
 */
export async function GET() {
  const tenant = await getTenant()
  const tamil = !tenant || tenant.defaultLanguage === "ta"
  const name = tenant ? (tamil ? tenant.nameTa : tenant.nameEn) : "FarmForYou"
  const manifest = {
    name,
    short_name: tenant ? tenant.nameEn : "FarmForYou",
    description: tenant ? `${tenant.nameEn} — farm-fresh orders` : "Farm-fresh orders from local farms",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6ee",
    theme_color: "#f4f6ee",
    lang: tamil ? "ta" : "en",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
  return Response.json(manifest, { headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=3600" } })
}
