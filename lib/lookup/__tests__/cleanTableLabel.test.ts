import { describe, expect, it } from 'vitest'
import { cleanTableLabel } from '../cleanTableLabel'

describe('cleanTableLabel', () => {
  it('strips leading "S01 - " prefix', () => {
    expect(cleanTableLabel('S01 - Sexe')).toBe('Sexe')
    expect(cleanTableLabel('S04 - Contexte')).toBe('Contexte')
    expect(cleanTableLabel("S04/S36 - Article d'indemnisation")).toBe(
      "Article d'indemnisation"
    )
  })

  it('strips leading "A27 - " / "DMFA - " etc.', () => {
    expect(cleanTableLabel('A27 - Périodes assimilées')).toBe('Périodes assimilées')
    expect(cleanTableLabel('DMFA - Quelque chose')).toBe('Quelque chose')
  })

  it('strips leading "S07Foo" CamelCase prefix (no dash)', () => {
    expect(cleanTableLabel('S07Noss code')).toBe('Noss code')
    expect(cleanTableLabel('S15Undue')).toBe('Undue')
    expect(cleanTableLabel('S25Mandatory remplacement')).toBe('Mandatory remplacement')
    expect(cleanTableLabel('S42Type')).toBe('Type')
  })

  it('strips trailing "(S01)" suffix matching the given prefix', () => {
    expect(cleanTableLabel('Nationalité (codification BCSS) (S01)', 'S01')).toBe(
      'Nationalité (codification BCSS)'
    )
    expect(
      cleanTableLabel('Organisme de paiement des allocations de chômage (S01)', 'S01')
    ).toBe('Organisme de paiement des allocations de chômage')
  })

  it('strips generic trailing "(SXX)" when no prefix given', () => {
    expect(cleanTableLabel("Identification de l'action (S38)")).toBe(
      "Identification de l'action"
    )
  })

  it('capitalises the first letter', () => {
    expect(cleanTableLabel("lieu d'entretien DISPO")).toBe("Lieu d'entretien DISPO")
    expect(cleanTableLabel('périodes assimilées')).toBe('Périodes assimilées')
  })

  it('does not double-process already-clean labels', () => {
    expect(cleanTableLabel('Sexe')).toBe('Sexe')
    expect(cleanTableLabel('Nationalité')).toBe('Nationalité')
  })

  it('handles empty / whitespace input', () => {
    expect(cleanTableLabel('')).toBe('')
    expect(cleanTableLabel('  ')).toBe('')
  })

  it('does not strip when prefix is part of the actual meaning', () => {
    // "PWA" alone n'est pas un prefix module → on ne touche pas
    expect(cleanTableLabel('PWA actif')).toBe('PWA actif')
  })
})
