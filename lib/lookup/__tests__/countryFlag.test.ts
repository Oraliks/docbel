import { describe, expect, it } from 'vitest'
import { getCountryIso2 } from '../countryFlag'

describe('getCountryIso2', () => {
  it('matches simple country labels', () => {
    expect(getCountryIso2('France')).toBe('FR')
    expect(getCountryIso2('Belgique')).toBe('BE')
    expect(getCountryIso2('Maroc')).toBe('MA')
    expect(getCountryIso2('Italie')).toBe('IT')
  })

  it('strips parenthetical content (Allemagne (Rép.féd.))', () => {
    expect(getCountryIso2('Allemagne (Rép.féd.)')).toBe('DE')
    expect(getCountryIso2('Allemagne (République Démocratique)')).toBe('DE')
    expect(getCountryIso2('Luxembourg (Grand-Duché)')).toBe('LU')
    expect(getCountryIso2('Pologne (République)')).toBe('PL')
  })

  it('handles DRC variations', () => {
    expect(getCountryIso2('Congo (Rép. dém.)')).toBe('CD')
    expect(getCountryIso2('Zaïre')).toBe('CD')
    expect(getCountryIso2('Zaire (République du)')).toBe('CD')
  })

  it('handles distinct Congo Brazzaville', () => {
    expect(getCountryIso2('Congo-Brazzaville')).toBe('CG')
    expect(getCountryIso2('Congo (République du)')).toBe('CG')
  })

  it('handles British dependencies and statuses', () => {
    expect(getCountryIso2('Gibraltar (Royaume-Uni)')).toBe('GI')
    expect(getCountryIso2('Royaume-Uni')).toBe('GB')
    expect(getCountryIso2('Citoyen britannique')).toBe('GB')
  })

  it('handles French territories', () => {
    expect(getCountryIso2('Réunion (France)')).toBe('RE')
    expect(getCountryIso2('Guadeloupe (France)')).toBe('GP')
    expect(getCountryIso2('Martinique (France)')).toBe('MQ')
    expect(getCountryIso2('Polynésie française (France)')).toBe('PF')
  })

  it("handles d'origine X adjective forms", () => {
    expect(getCountryIso2("d'origine française")).toBe('FR')
    expect(getCountryIso2("d'origine marocaine")).toBe('MA')
    expect(getCountryIso2("d'origine congolaise")).toBe('CD')
    expect(getCountryIso2("d'origine kosovare")).toBe('XK')
    expect(getCountryIso2("d'origine tibétaine")).toBe('CN')
  })

  it("handles 'originaire de X' variants", () => {
    expect(getCountryIso2('originaire des Emirats Arabes Unis')).toBe('AE')
    expect(getCountryIso2('originaire de Guinée-Bissau')).toBe('GW')
    expect(getCountryIso2('originaire de Myanmar')).toBe('MM')
  })

  it('returns null for historical entities (URSS, Yougoslavie)', () => {
    expect(getCountryIso2('Union républiques sociales soviétiques')).toBeNull()
    expect(getCountryIso2('Tchecoslovaquie')).toBeNull()
    expect(getCountryIso2('Serbie et Montenegro')).toBeNull()
  })

  it('returns null for stateless / undetermined statuses', () => {
    expect(getCountryIso2('Apatride')).toBeNull()
    expect(getCountryIso2('Indéterminé')).toBeNull()
    expect(getCountryIso2('pas encore définitivement établie')).toBeNull()
  })

  it('returns null for empty / unknown input', () => {
    expect(getCountryIso2('')).toBeNull()
    expect(getCountryIso2('Pays-Lol')).toBeNull()
  })
})
