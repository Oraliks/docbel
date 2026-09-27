import { describe, expect, it } from "vitest"
import { assertNoForbiddenExportKeys, PRIVACY_EXPORT_MAX_PAGE_SIZE } from "../export"

describe("privacy export safety", () => {
  it.each([
    "password",
    "token",
    "accessToken",
    "refreshToken",
    "idToken",
    "confirmationToken",
    "notifyToken",
    "resumeCode",
    "resumeCodeHash",
    "citizenNrnHash",
    "citizenNrnEnc",
    "ipHash",
    "internalNote",
    "adminNote",
    "organizationNote",
  ])("refuse la clé sensible %s même profondément imbriquée", (key) => {
    expect(() => assertNoForbiddenExportKeys([{ safe: { [key]: "secret" } }])).toThrow(key)
  })

  it("accepte les champs métier explicitement exportables", () => {
    expect(() => assertNoForbiddenExportKeys([{ id: "row-1", payload: { answer: "oui" } }])).not.toThrow()
  })

  it("borne les pages à cent lignes", () => {
    expect(PRIVACY_EXPORT_MAX_PAGE_SIZE).toBe(100)
  })
})
