import { headers } from "next/headers"
import { getTenant } from "@/lib/tenant"
import type { HostApp } from "@/domain/app-hosts"
import { appIdentity, appIcon, type InstallApp } from "@/domain/install-apps"

/**
 * The install manifest. Three apps can be installed, one per role, each with its own id, icon colour and name:
 *   /app-manifest            the shop, for customers: the farm's name, a cream icon;
 *   /app-manifest?app=farm   the farm app, for the farm admin and staff: opens /farm, a green icon;
 *   /app-manifest?app=admin  FarmForYou admin, for the super admin: opens /admin, a dark icon.
 * A phone can hold all of them side by side. See src/domain/install-apps.ts.
 * On an address of one app's own (src/domain/app-hosts.ts) that app is the one installed, whatever was asked, and it
 * covers the whole address. With every app on one address, each covers only its own pages (the shop the rest), so
 * Android doesn't count one as the other already installed.
 */
export async function GET(request: Request) {
  const h = await headers()
  const hostApp = (h.get("x-host-app") ?? "all") as HostApp
  const param = new URL(request.url).searchParams.get("app")
  const asked: InstallApp = param === "farm" || param === "admin" ? param : "shop"
  const app: InstallApp = hostApp === "shop" ? "shop" : hostApp === "farm" ? "farm" : hostApp === "portal" ? "admin" : asked
  const tenant = app === "admin" ? null : await getTenant()
  // The farm app carries the farm's name and logo only on the farm's own address; elsewhere it is FarmForYou's
  const farmAddress = h.get("x-farm-address") === "1"
  const id = appIdentity(app, tenant, farmAddress)
  const logo = app === "farm" && !farmAddress ? null : tenant?.logoUrl
  // On one shared address (before farms have subdomains), another farm's apps open through /f/<farm>, which picks
  // that farm again on every launch; the id differs too, so two farms' apps on one phone stay separate apps.
  const shared = !process.env.NEXT_PUBLIC_ROOT_DOMAIN && tenant && tenant.slug !== process.env.DEFAULT_TENANT_SLUG
  const start = shared ? `/f/${tenant.slug}${id.startUrl === "/" ? "" : id.startUrl}` || "/" : id.startUrl
  // A /f/<farm> start (another farm on the shared address) lies outside /farm, so that app covers the whole address
  const scope = hostApp !== "all" || app === "shop" || !start.startsWith(`/${app}`) ? "/" : `/${app}`
  const manifest = {
    id: start,
    name: id.name,
    short_name: id.shortName,
    description: id.description,
    start_url: start,
    scope,
    display: "standalone",
    // The splash screen is the icon's own colour, so each app is recognisable while it opens.
    background_color: id.colour,
    theme_color: "#f4f6ee",
    lang: id.lang,
    // The shop and farm apps' icons are the farm's own logo once it has one; the admin app keeps its fixed icon.
    icons: [
      { src: app !== "admin" ? appIcon(app, logo, 192) : `/icons/${app}-192.png`, sizes: "192x192", type: "image/png" },
      { src: app !== "admin" ? appIcon(app, logo, 512) : `/icons/${app}-512.png`, sizes: "512x512", type: "image/png" },
      {
        src: app !== "admin" ? appIcon(app, logo, 512, true) : `/icons/${app}-maskable-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
  return Response.json(manifest, { headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=3600" } })
}
