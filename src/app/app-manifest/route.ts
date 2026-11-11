import { getTenant } from "@/lib/tenant"
import { appIdentity, type InstallApp } from "@/domain/install-apps"

/**
 * The install manifest. Three apps can be installed, one per role, each with its own id, icon colour and name:
 *   /app-manifest            the shop, for customers: the farm's name, a cream icon;
 *   /app-manifest?app=farm   the farm app, for the farm admin and staff: opens /farm, a green icon;
 *   /app-manifest?app=admin  FarmForYou admin, for the super admin: opens /admin, a dark icon.
 * A phone can hold all of them side by side. See src/domain/install-apps.ts.
 */
export async function GET(request: Request) {
  const param = new URL(request.url).searchParams.get("app")
  const app: InstallApp = param === "farm" || param === "admin" ? param : "shop"
  const tenant = app === "admin" ? null : await getTenant()
  const id = appIdentity(app, tenant)
  const manifest = {
    id: id.startUrl,
    name: id.name,
    short_name: id.shortName,
    description: id.description,
    start_url: id.startUrl,
    scope: "/",
    display: "standalone",
    // The splash screen is the icon's own colour, so each app is recognisable while it opens.
    background_color: id.colour,
    theme_color: "#f4f6ee",
    lang: id.lang,
    icons: [
      { src: `/icons/${app}-192.png`, sizes: "192x192", type: "image/png" },
      { src: `/icons/${app}-512.png`, sizes: "512x512", type: "image/png" },
      { src: `/icons/${app}-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
  return Response.json(manifest, { headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=3600" } })
}
