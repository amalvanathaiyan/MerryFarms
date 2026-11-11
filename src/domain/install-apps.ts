/**
 * The three apps a phone can install, one per role. Pure, so it is tested.
 *   shop:  customers. Named after the farm.
 *   farm:  the farm admin and staff. Opens straight into /farm.
 *   admin: the FarmForYou super admin. Opens /admin; belongs to no farm.
 * Labels under home-screen icons show about 10 letters, and Tamil letters are wider, so short names stay short:
 * the shop keeps the farm's English name and the farm app is one word.
 */
export type InstallApp = "shop" | "farm" | "admin"

export interface AppIdentity {
  name: string
  shortName: string
  description: string
  startUrl: string
  /** The icon's background, also used for the splash screen. Matches scripts/art/icons.mjs. */
  colour: string
  lang: "ta" | "en"
}

export const APP_COLOURS: Record<InstallApp, string> = { shop: "#FBF3DC", farm: "#1E6B45", admin: "#16301F" }

type Farm = { nameTa: string; nameEn: string; defaultLanguage: string } | null

export function appIdentity(app: InstallApp, farm: Farm): AppIdentity {
  if (app === "admin") {
    return { name: "FarmForYou Admin", shortName: "FFY Admin", description: "Every farm on FarmForYou", startUrl: "/admin", colour: APP_COLOURS.admin, lang: "en" }
  }
  const tamil = !farm || farm.defaultLanguage === "ta"
  const lang = tamil ? "ta" : "en"
  const farmName = farm ? (tamil ? farm.nameTa : farm.nameEn) : "FarmForYou"
  const brand = farm?.nameEn ?? "FarmForYou"
  if (app === "farm") {
    return {
      name: `${farmName} · ${tamil ? "பண்ணை ஆப்" : "Farm app"}`,
      shortName: tamil ? "பண்ணை" : "My Farm",
      description: `${brand} — orders, birds and money`,
      startUrl: "/farm",
      colour: APP_COLOURS.farm,
      lang,
    }
  }
  return {
    name: farmName,
    shortName: brand,
    description: farm ? `${brand} — farm-fresh orders` : "Farm-fresh orders from local farms",
    startUrl: "/",
    colour: APP_COLOURS.shop,
    lang,
  }
}

/**
 * The shop app's icon: made from the farm's logo once it has one (src/app/img/app-icon), else the cream
 * FarmForYou icon. The logo's upload time rides along (?v), so phones fetch the icon again when the logo changes.
 */
export function shopIcon(logoUrl: string | null | undefined, size: 180 | 192 | 512, maskable = false): string {
  const v = logoUrl ? new URL(logoUrl, "http://x").searchParams.get("v") : null
  if (!v) return size === 180 ? "/icons/shop-apple.png" : `/icons/shop-${maskable ? "maskable-" : ""}${size}.png`
  return `/img/app-icon?size=${size}${maskable ? "&maskable=1" : ""}&v=${v}`
}
