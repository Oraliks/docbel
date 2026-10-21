import { describe, expect, it } from "vitest"
import { parseFamilySituationAmount } from "../amount"

describe("monthly amounts entered in the public family journey", () => {
  it.each(["1200", "1 200", "1\u00a0200", "1\u202f200", "1200,00", "1200.00", " 1 200,00 "])("reads %s as the same monthly amount", (value) => {
    expect(parseFamilySituationAmount(value)).toBe(1200)
  })
  it.each(["", " ", "-1", "NaN", "Infinity", "1e3", "1,200.00", "1.200,00", "12 00", "1 2 0 0", "1,234", "100 euros", "1\n200"])("rejects malformed or ambiguous amount %s", (value) => {
    expect(parseFamilySituationAmount(value)).toBeUndefined()
  })
  it("keeps zero and cents without treating a missing value as zero", () => {
    expect(parseFamilySituationAmount("0")).toBe(0)
    expect(parseFamilySituationAmount("1 200,50")).toBe(1200.5)
    expect(parseFamilySituationAmount(undefined)).toBeUndefined()
  })
})
