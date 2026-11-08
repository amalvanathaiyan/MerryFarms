import { describe, expect, it } from "vitest"
import { checkUsername, isEmailLogin, normaliseUsername } from "./username"

describe("usernames", () => {
  it("ignores case and spaces around it", () => {
    expect(normaliseUsername("  Amal.V ")).toBe("amal.v")
  })

  it("tells an email from a username by the @", () => {
    expect(isEmailLogin("amal@example.com")).toBe(true)
    expect(isEmailLogin("amal")).toBe(false)
  })

  it("accepts plain names", () => {
    for (const ok of ["amal", "merry_farms", "amal.v", "farm-2", "abc"]) expect(checkUsername(ok)).toBeNull()
  })

  it("refuses names that are too short, too long, or oddly written", () => {
    for (const bad of ["", "ab", "a".repeat(31), "2amal", "_amal", "amal_", "am..al", "am al", "amal@x", "அமல்", "Amal"]) expect(checkUsername(bad)).toBe("username_invalid")
  })
})
