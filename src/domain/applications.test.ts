import { describe, expect, it } from "vitest"
import { applicationNumber, cleanChecklist, detailsProblem, isOpen, missingChecks, needsReply, nextStates } from "./applications"

const ok = { email: "a@b.in", pincode: "641001" }

describe("farm applications", () => {
  it("checks the details a farm gives, optional ones only when filled", () => {
    expect(detailsProblem(ok)).toBeNull()
    expect(detailsProblem({ ...ok, fssai: "", gstin: null, pan: undefined })).toBeNull()
    expect(detailsProblem({ ...ok, email: "abc" })).toBe("email")
    expect(detailsProblem({ ...ok, pincode: "041001" })).toBe("pincode")
    expect(detailsProblem({ ...ok, fssai: "1234" })).toBe("fssai")
    expect(detailsProblem({ ...ok, fssai: "12345678901234", gstin: "33ABCDE1234F1Z5", pan: "ABCDE1234F" })).toBeNull()
    expect(detailsProblem({ ...ok, gstin: "33ABC" })).toBe("gstin")
    expect(detailsProblem({ ...ok, pan: "abcde1234f" })).toBe("pan")
  })

  it("needs the phone and location checked before approving", () => {
    expect(missingChecks({})).toEqual(["phone", "location"])
    expect(missingChecks({ phone: true, location: true, visit: "yes" })).toEqual([])
    expect(cleanChecklist({ phone: true, nope: true, call: false })).toEqual({ phone: true })
  })

  it("moves through review; approved is final", () => {
    expect(nextStates("applied")).toContain("reviewing")
    expect(nextStates("approved")).toEqual([])
    expect(nextStates("rejected")).toEqual(["reviewing"])
    expect(isOpen("needs_info")).toBe(true)
    expect(isOpen("rejected")).toBe(false)
    expect(needsReply("needs_info") && needsReply("rejected") && !needsReply("on_hold")).toBe(true)
  })

  it("numbers applications for the farm to quote", () => {
    expect(applicationNumber(7)).toBe("FFY-J0007")
  })
})
