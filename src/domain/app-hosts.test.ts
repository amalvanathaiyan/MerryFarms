import { describe, expect, it } from "vitest"
import { appBase, belongsElsewhere, hostConfigFromEnv, openingApp, readHost } from "./app-hosts"

const domain = hostConfigFromEnv({ NEXT_PUBLIC_ROOT_DOMAIN: "farmforyou.in", DEFAULT_TENANT_SLUG: "merryfarms" })
const vercel = hostConfigFromEnv({
  SHOP_HOST: "merry-farms.vercel.app",
  FARM_APP_HOST: "https://farmforyou-farm.vercel.app/",
  PORTAL_HOST: "farmforyou.vercel.app",
  DEFAULT_TENANT_SLUG: "merryfarms",
})
const none = hostConfigFromEnv({ DEFAULT_TENANT_SLUG: "merryfarms" })

describe("readHost", () => {
  it("reads the farm and the app from the domain's subdomains", () => {
    expect(readHost("merryfarms.farmforyou.in", domain)).toEqual({ app: "shop", slug: "merryfarms" })
    expect(readHost("merryfarms-farm.farmforyou.in", domain)).toEqual({ app: "farm", slug: "merryfarms" })
    expect(readHost("farmforyou.in", domain)).toEqual({ app: "portal", slug: null })
    expect(readHost("www.farmforyou.in", domain)).toEqual({ app: "portal", slug: null })
    expect(readHost("admin.farmforyou.in", domain)).toEqual({ app: "portal", slug: null })
  })

  it("knows the fixed addresses before the domain, whatever farm they show", () => {
    expect(readHost("merry-farms.vercel.app", vercel)).toEqual({ app: "shop", slug: null })
    expect(readHost("farmforyou-farm.vercel.app", vercel)).toEqual({ app: "farm", slug: null })
    expect(readHost("farmforyou.vercel.app", vercel)).toEqual({ app: "portal", slug: null })
  })

  it("keeps every app on one address anywhere else", () => {
    expect(readHost("localhost:3000", none)).toEqual({ app: "all", slug: null })
    expect(readHost("merry-farms-git-x.vercel.app", vercel)).toEqual({ app: "all", slug: null })
    expect(readHost("merryfarms.localhost:3000", none)).toEqual({ app: "all", slug: "merryfarms" })
    expect(readHost("merryfarms-farm.localhost:3000", none)).toEqual({ app: "farm", slug: "merryfarms" })
  })
})

describe("appBase", () => {
  it("gives each farm its own shop and farm-app address with the domain", () => {
    expect(appBase("shop", "merryfarms", domain)).toBe("https://merryfarms.farmforyou.in")
    expect(appBase("farm", "merryfarms", domain)).toBe("https://merryfarms-farm.farmforyou.in")
    expect(appBase("portal", "merryfarms", domain)).toBe("https://farmforyou.in")
  })

  it("picks another farm with a /f/ link on the fixed addresses", () => {
    expect(appBase("shop", "merryfarms", vercel)).toBe("https://merry-farms.vercel.app")
    expect(appBase("farm", "greenacre", vercel)).toBe("https://farmforyou-farm.vercel.app/f/greenacre")
    expect(appBase("portal", "greenacre", vercel)).toBe("https://farmforyou.vercel.app")
  })

  it("stays on this address when apps have no addresses of their own", () => {
    expect(appBase("farm", "merryfarms", none)).toBeNull()
  })
})

describe("belongsElsewhere", () => {
  it("sends the farm app's and admin's pages away from the shop", () => {
    expect(belongsElsewhere("shop", "/", "", false)).toBeNull()
    expect(belongsElsewhere("shop", "/my/abc", "", false)).toBeNull()
    expect(belongsElsewhere("shop", "/farm/orders", "", false)).toBe("farm")
    expect(belongsElsewhere("shop", "/login", "", false)).toBe("farm")
    expect(belongsElsewhere("shop", "/login", "?next=%2Fadmin", false)).toBe("portal")
    expect(belongsElsewhere("shop", "/admin", "", false)).toBe("portal")
  })

  it("opens the farm app at /farm and sends customers' pages to the shop", () => {
    expect(belongsElsewhere("farm", "/", "", false)).toBe("farm-home")
    expect(belongsElsewhere("farm", "/farm", "", false)).toBeNull()
    expect(belongsElsewhere("farm", "/login", "?next=/farm", false)).toBeNull()
    expect(belongsElsewhere("farm", "/i/token", "", false)).toBe("shop")
    expect(belongsElsewhere("farm", "/admin/farms", "", false)).toBe("portal")
  })

  it("keeps admin on the portal, and a farm's app there only in support mode", () => {
    expect(belongsElsewhere("portal", "/", "", false)).toBe("admin-home")
    expect(belongsElsewhere("portal", "/admin", "", false)).toBeNull()
    expect(belongsElsewhere("portal", "/login", "?next=/admin", false)).toBeNull()
    expect(belongsElsewhere("portal", "/farm", "", true)).toBeNull()
    expect(belongsElsewhere("portal", "/farm", "", false)).toBe("farm")
    expect(belongsElsewhere("portal", "/my", "", false)).toBe("shop")
  })

  it("serves sign-in links, images and the manifest everywhere", () => {
    for (const app of ["shop", "farm", "portal"] as const) {
      for (const p of ["/auth/callback", "/forgot-password", "/app-manifest", "/img/logo", "/api/cron/tick"]) expect(belongsElsewhere(app, p, "", false)).toBeNull()
    }
  })

  it("changes nothing when every app is on one address", () => {
    expect(belongsElsewhere("all", "/farm", "", false)).toBeNull()
    expect(belongsElsewhere("all", "/", "", false)).toBeNull()
  })
})

describe("openingApp", () => {
  it("plays the address's own app", () => {
    expect(openingApp("shop", "/")).toBe("shop")
    expect(openingApp("farm", "/login")).toBe("farm")
    expect(openingApp("portal", "/admin")).toBe("admin")
    expect(openingApp("portal", "/farm")).toBe("farm")
  })

  it("goes by the path when every app is on one address", () => {
    expect(openingApp("all", "/")).toBe("shop")
    expect(openingApp("all", "/farm/orders")).toBe("farm")
    expect(openingApp("all", "/login")).toBe("farm")
    expect(openingApp("all", "/login", "?next=%2Fadmin")).toBe("admin")
    expect(openingApp("all", "/admin")).toBe("admin")
  })
})
