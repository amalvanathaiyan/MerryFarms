import { describe, expect, it } from "vitest"
import { appIcon, appIdentity } from "./install-apps"

const tamilFarm = { nameTa: "மெர்ரி ஃபார்ம்ஸ்", nameEn: "Merry Farms", defaultLanguage: "ta" }
const englishFarm = { nameTa: "பசுமை தோட்டம்", nameEn: "Green Acre", defaultLanguage: "en" }

describe("install apps", () => {
  it("names the shop after the farm, with a short English label", () => {
    expect(appIdentity("shop", tamilFarm)).toMatchObject({ name: "மெர்ரி ஃபார்ம்ஸ்", shortName: "Merry Farms", startUrl: "/", lang: "ta" })
    expect(appIdentity("shop", englishFarm)).toMatchObject({ name: "Green Acre", shortName: "Green Acre", lang: "en" })
  })

  it("gives the farm app a one-word label in the farm's language, opening the farm app", () => {
    expect(appIdentity("farm", tamilFarm)).toMatchObject({ shortName: "பண்ணை", startUrl: "/farm" })
    expect(appIdentity("farm", englishFarm)).toMatchObject({ shortName: "My Farm", name: "Green Acre · Farm app" })
  })

  it("keeps the admin app the same for every farm", () => {
    expect(appIdentity("admin", tamilFarm)).toEqual(appIdentity("admin", null))
    expect(appIdentity("admin", null)).toMatchObject({ shortName: "FFY Admin", startUrl: "/admin" })
  })

  it("gives each app its own colour, so the icons and splash screens differ", () => {
    const colours = (["shop", "farm", "admin"] as const).map((a) => appIdentity(a, tamilFarm).colour)
    expect(new Set(colours).size).toBe(3)
  })

  it("keeps home-screen labels short enough not to be cut", () => {
    for (const farm of [tamilFarm, englishFarm]) for (const a of ["farm", "admin"] as const) expect(appIdentity(a, farm).shortName.length).toBeLessThanOrEqual(10)
  })
})

describe("appIcon", () => {
  it("keeps the fixed FarmForYou icons until the farm has a logo", () => {
    expect(appIcon("shop", null, 192)).toBe("/icons/shop-192.png")
    expect(appIcon("shop", null, 512, true)).toBe("/icons/shop-maskable-512.png")
    expect(appIcon("shop", undefined, 180)).toBe("/icons/shop-apple.png")
    expect(appIcon("farm", null, 512, true)).toBe("/icons/farm-maskable-512.png")
    expect(appIcon("farm", null, 180)).toBe("/icons/farm-apple.png")
  })

  it("is made from the farm's logo once it has one, renewed when the logo changes", () => {
    expect(appIcon("shop", "/img/logo?v=123", 192)).toBe("/img/app-icon?size=192&v=123")
    expect(appIcon("shop", "/img/logo?v=123", 512, true)).toBe("/img/app-icon?size=512&maskable=1&v=123")
    expect(appIcon("shop", "/img/logo?v=456", 180)).toBe("/img/app-icon?size=180&v=456")
  })

  it("marks the farm app's icon so it is drawn on the farm app's green", () => {
    expect(appIcon("farm", "/img/logo?v=123", 192)).toBe("/img/app-icon?app=farm&size=192&v=123")
    expect(appIcon("farm", "/img/logo?v=123", 512, true)).toBe("/img/app-icon?app=farm&size=512&maskable=1&v=123")
  })
})
