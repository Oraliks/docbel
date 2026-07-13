import { describe, it, expect } from "vitest"
import { isLockActive, isBanActive } from "./user-360"

const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
const past = new Date(Date.now() - 60 * 60 * 1000).toISOString()

describe("isLockActive", () => {
  it("false quand pas de verrou", () => {
    expect(isLockActive(null)).toBe(false)
  })
  it("true quand le verrou expire dans le futur", () => {
    expect(isLockActive(future)).toBe(true)
  })
  it("false quand le verrou est expiré", () => {
    expect(isLockActive(past)).toBe(false)
  })
})

describe("isBanActive", () => {
  it("false quand pas banni", () => {
    expect(isBanActive(false, null)).toBe(false)
    expect(isBanActive(false, future)).toBe(false)
  })
  it("true quand banni sans expiration (permanent)", () => {
    expect(isBanActive(true, null)).toBe(true)
  })
  it("true quand banni et l'expiration est dans le futur", () => {
    expect(isBanActive(true, future)).toBe(true)
  })
  it("false quand banni mais l'expiration est passée", () => {
    expect(isBanActive(true, past)).toBe(false)
  })
})
