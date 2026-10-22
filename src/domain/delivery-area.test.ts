import { describe, expect, it } from "vitest"
import { checkArea, directionsLink, distanceKm, parseLocation, parsePincodes, type DeliveryArea } from "./delivery-area"

// Chennai Central and Tambaram railway stations: about 24.7 km apart in a straight line.
const central = { lat: 13.0827, lng: 80.2757 }
const tambaram = { lat: 12.9249, lng: 80.1 }
const farm = { lat: 12.95, lng: 80.14 }
const near = { lat: 12.96, lng: 80.15 } // ~1.5 km from the farm

describe("distance", () => {
  it("measures straight-line distance in km", () => {
    expect(distanceKm(central, tambaram)).toBeGreaterThan(24)
    expect(distanceKm(central, tambaram)).toBeLessThan(26)
    expect(distanceKm(farm, farm)).toBe(0)
  })
})

describe("delivery area check", () => {
  const radius: DeliveryArea = { farm, radiusKm: 8, pincodes: [] }
  const both: DeliveryArea = { farm, radiusKm: 8, pincodes: ["600048"] }
  const pinsOnly: DeliveryArea = { farm: null, radiusKm: null, pincodes: ["600042", "600043"] }

  it("is inside or outside by shared location", () => {
    expect(checkArea(radius, { location: near })).toMatchObject({ result: "inside", by: "location" })
    const far = checkArea(radius, { location: central })
    expect(far).toMatchObject({ result: "outside", by: "location" })
    expect(far.distanceKm).toBeGreaterThan(8)
  })

  it("lets a listed PIN override a location just past the radius", () => {
    expect(checkArea(both, { location: central, pincode: "600048" })).toMatchObject({ result: "inside", by: "pincode" })
  })

  it("decides by PIN on a PIN-only farm", () => {
    expect(checkArea(pinsOnly, { pincode: "600042" }).result).toBe("inside")
    expect(checkArea(pinsOnly, { pincode: "600099" }).result).toBe("outside")
  })

  it("can't decide without a location on a radius farm, unless the PIN is listed", () => {
    expect(checkArea(radius, { pincode: "600099" }).result).toBe("unknown")
    expect(checkArea(both, { pincode: "600048" }).result).toBe("inside")
    expect(checkArea(radius, {}).result).toBe("unknown")
  })

  it("checks nothing until the farm sets an area", () => {
    expect(checkArea({ farm: null, radiusKm: null, pincodes: [] }, { location: central }).result).toBe("unknown")
    expect(checkArea({ farm, radiusKm: null, pincodes: [] }, { location: central }).result).toBe("unknown")
  })
})

describe("reading a pasted location", () => {
  it("understands Google Maps links and plain coordinates", () => {
    expect(parseLocation("https://www.google.com/maps/place/Farm/@12.9516,80.1462,17z/data=!3m1")).toEqual({ lat: 12.9516, lng: 80.1462 })
    expect(parseLocation("https://maps.google.com/?q=12.9516,80.1462")).toEqual({ lat: 12.9516, lng: 80.1462 })
    expect(parseLocation("https://www.google.com/maps/place/X/data=!4m6!3d12.9516!4d80.1462")).toEqual({ lat: 12.9516, lng: 80.1462 })
    expect(parseLocation(" 12.9516, 80.1462 ")).toEqual({ lat: 12.9516, lng: 80.1462 })
    expect(parseLocation("https://maps.app.goo.gl/abc123")).toBeNull() // short links hide the coordinates
    expect(parseLocation("95.1, 80.1")).toBeNull()
  })
  it("builds a directions link", () => {
    expect(directionsLink(near)).toBe("https://www.google.com/maps/dir/?api=1&destination=12.960000,80.150000")
  })
})

describe("PIN codes", () => {
  it("reads a typed list and flags mistakes", () => {
    expect(parsePincodes("600043, 600042\n600042; 12345 0600001")).toEqual({ valid: ["600042", "600043"], invalid: ["12345", "0600001"] })
  })
})
