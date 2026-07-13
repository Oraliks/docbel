import { describe, it, expect } from "vitest"
import {
  parseUsersQuery,
  buildUsersWhere,
  buildUsersOrderBy,
  usersQueryToSearchParams,
  resolveUserSegmentFields,
  DEFAULT_USER_PAGE_SIZE,
  DEFAULT_USER_SORT,
} from "./users"

describe("parseUsersQuery", () => {
  it("retombe sur les défauts pour une entrée vide", () => {
    expect(parseUsersQuery(undefined)).toEqual({
      q: "",
      role: null,
      segment: null,
      status: null,
      sort: DEFAULT_USER_SORT,
      page: 1,
      pageSize: DEFAULT_USER_PAGE_SIZE,
    })
  })

  it("lit un objet searchParams Next (string | string[])", () => {
    const q = parseUsersQuery({
      q: "  Alice ",
      role: "admin",
      segment: "employeur",
      status: "active",
      sort: "name",
      page: "3",
      pageSize: "50",
    })
    expect(q).toEqual({
      q: "Alice",
      role: "admin",
      segment: "employeur",
      status: "active",
      sort: "name",
      page: 3,
      pageSize: 50,
    })
  })

  it("lit un URLSearchParams et prend la première valeur d'un tableau", () => {
    expect(parseUsersQuery(new URLSearchParams("q=bob&role=partner")).role).toBe(
      "partner",
    )
    expect(parseUsersQuery({ role: ["admin", "user"] }).role).toBe("admin")
  })

  it("ignore les valeurs invalides sans lever d'erreur", () => {
    const q = parseUsersQuery({
      role: "wizard",
      segment: "citoyen", // pas un segment de compte valide
      status: "banned",
      sort: "email", // non autorisé au tri
      page: "-4",
      pageSize: "7", // hors des tailles autorisées
    })
    expect(q.role).toBeNull()
    expect(q.segment).toBeNull()
    expect(q.status).toBeNull()
    expect(q.sort).toBe(DEFAULT_USER_SORT)
    expect(q.page).toBe(1)
    expect(q.pageSize).toBe(DEFAULT_USER_PAGE_SIZE)
  })

  it("accepte le filtre segment=none", () => {
    expect(parseUsersQuery({ segment: "none" }).segment).toBe("none")
  })
})

describe("buildUsersWhere", () => {
  it("ne filtre rien quand tout est par défaut", () => {
    expect(buildUsersWhere(parseUsersQuery(undefined))).toEqual({})
  })

  it("mappe role/status/segment", () => {
    const where = buildUsersWhere(
      parseUsersQuery({ role: "admin", status: "locked", segment: "partenaire" }),
    )
    expect(where.role).toBe("admin")
    expect(where.status).toBe("locked")
    expect(where.segment).toBe("partenaire")
  })

  it("traduit segment=none en segment IS NULL", () => {
    const where = buildUsersWhere(parseUsersQuery({ segment: "none" }))
    expect(where.segment).toBeNull()
  })

  it("construit un OR insensible à la casse sur name + email", () => {
    const where = buildUsersWhere(parseUsersQuery({ q: "dupont" }))
    expect(where.OR).toEqual([
      { name: { contains: "dupont", mode: "insensitive" } },
      { email: { contains: "dupont", mode: "insensitive" } },
    ])
  })
})

describe("buildUsersOrderBy", () => {
  it("gère l'ordre décroissant par défaut", () => {
    expect(buildUsersOrderBy("-createdAt")).toEqual({ createdAt: "desc" })
  })

  it("gère l'ordre croissant", () => {
    expect(buildUsersOrderBy("name")).toEqual({ name: "asc" })
  })

  it("pousse les lastLoginAt null en fin de liste", () => {
    expect(buildUsersOrderBy("-lastLoginAt")).toEqual({
      lastLoginAt: { sort: "desc", nulls: "last" },
    })
  })
})

describe("resolveUserSegmentFields", () => {
  it("segment employeur : TVA normalisée requise, partnerType/flags nettoyés", () => {
    const res = resolveUserSegmentFields({
      segment: "employeur",
      vatNumber: "BE 0123.456.749",
      partnerType: "onem", // ignoré pour un employeur
      partnerOrganization: "  ACME  ",
      isOrgManager: true,
    })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.fields.segment).toBe("employeur")
      expect(res.fields.vatNumber).toBe("BE0123456749")
      expect(res.fields.partnerType).toBeNull()
      expect(res.fields.partnerOrganization).toBe("ACME")
      expect(res.fields.isOrgManager).toBe(false)
    }
  })

  it("segment employeur : TVA invalide → erreur", () => {
    const res = resolveUserSegmentFields({ segment: "employeur", vatNumber: "BE123" })
    expect(res.ok).toBe(false)
  })

  it("segment partenaire : partnerType validé, flags conservés, TVA nulle", () => {
    const res = resolveUserSegmentFields({
      segment: "partenaire",
      partnerType: "organisme_paiement",
      vatNumber: "BE0123456749", // ignoré pour un partenaire
      isOrgManager: true,
      canViewRdvHistory: true,
    })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.fields.segment).toBe("partenaire")
      expect(res.fields.partnerType).toBe("organisme_paiement")
      expect(res.fields.vatNumber).toBeNull()
      expect(res.fields.isOrgManager).toBe(true)
      expect(res.fields.canViewRdvHistory).toBe(true)
    }
  })

  it("segment partenaire : partnerType invalide → erreur", () => {
    const res = resolveUserSegmentFields({
      segment: "partenaire",
      partnerType: "banque",
    })
    expect(res.ok).toBe(false)
  })

  it("sans segment : tout est remis à null/false", () => {
    const res = resolveUserSegmentFields({
      segment: null,
      partnerType: "onem",
      vatNumber: "BE0123456749",
      isOrgManager: true,
    })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.fields).toEqual({
        segment: null,
        partnerType: null,
        vatNumber: null,
        partnerOrganization: null,
        isOrgManager: false,
        canViewRdvHistory: false,
      })
    }
  })
})

describe("usersQueryToSearchParams", () => {
  it("omet les valeurs par défaut", () => {
    const params = usersQueryToSearchParams({
      q: "",
      role: null,
      segment: null,
      status: null,
      sort: DEFAULT_USER_SORT,
      page: 1,
      pageSize: DEFAULT_USER_PAGE_SIZE,
    })
    expect(params.toString()).toBe("")
  })

  it("sérialise les filtres actifs", () => {
    const params = usersQueryToSearchParams({
      q: "alice",
      role: "admin",
      segment: "none",
      sort: "name",
      page: 2,
      pageSize: 50,
    })
    expect(params.get("q")).toBe("alice")
    expect(params.get("role")).toBe("admin")
    expect(params.get("segment")).toBe("none")
    expect(params.get("sort")).toBe("name")
    expect(params.get("page")).toBe("2")
    expect(params.get("pageSize")).toBe("50")
  })
})
