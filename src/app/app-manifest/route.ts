import { getTenant } from "@/lib/tenant"

/**
 * The install manifest, per farm. Two apps can be installed from one farm's address:
 *   /app-manifest          the shop, for customers (opens the shop);
 *   /app-manifest?app=farm the farm app, for the owner and staff (opens straight into /farm).
 * Each has its own id, so a phone can have both icons, and each carries the farm's own name.
 */
export async function GET(request: Request) {
  const tenant = await getTenant()
  const farmApp = new URL(request.url).searchParams.get("app") === "farm"
  const tamil = !tenant || tenant.defaultLanguage === "ta"
  const farmName = tenant ? (tamil ? tenant.nameTa : tenant.nameEn) : "FarmForYou"
  const manifest = {
    id: farmApp ? "/farm" : "/",
    name: farmApp ? `${farmName} · ${tamil ? "பண்ணை ஆப்" : "Farm app"}` : farmName,
    short_name: farmApp ? `${tenant ? tenant.nameEn : "FarmForYou"} Farm` : tenant ? tenant.nameEn : "FarmForYou",
    description: farmApp ? `${tenant?.nameEn ?? "FarmForYou"} — orders, birds and money` : tenant ? `${tenant.nameEn} — farm-fresh orders` : "Farm-fresh orders from local farms",
    start_url: farmApp ? "/farm" : "/",
    scope: "/",
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
