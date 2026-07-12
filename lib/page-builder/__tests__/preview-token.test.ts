import { describe, it, expect } from 'vitest'
import { signPreviewToken, verifyPreviewToken } from '../preview-token'

// vitest.config.ts fournit BETTER_AUTH_SECRET (secret factice de test).

describe('preview-token — jetons d’aperçu HMAC', () => {
  it('signe un token non vide et déterministe pour un id', () => {
    const t1 = signPreviewToken('page-123')
    const t2 = signPreviewToken('page-123')
    expect(t1).toHaveLength(32)
    expect(t1).toBe(t2)
  })

  it('produit des tokens différents pour des ids différents', () => {
    expect(signPreviewToken('page-a')).not.toBe(signPreviewToken('page-b'))
  })

  it('vérifie un token valide pour le bon id', () => {
    const token = signPreviewToken('page-xyz')
    expect(verifyPreviewToken('page-xyz', token)).toBe(true)
  })

  it('rejette un token valide présenté pour un autre id', () => {
    const token = signPreviewToken('page-xyz')
    expect(verifyPreviewToken('page-autre', token)).toBe(false)
  })

  it('rejette un token vide, null ou undefined', () => {
    expect(verifyPreviewToken('page-xyz', '')).toBe(false)
    expect(verifyPreviewToken('page-xyz', null)).toBe(false)
    expect(verifyPreviewToken('page-xyz', undefined)).toBe(false)
  })

  it('rejette un token de mauvaise longueur sans lever d’exception', () => {
    expect(verifyPreviewToken('page-xyz', 'trop-court')).toBe(false)
  })

  it('signe une chaîne vide pour un id vide (fail-soft)', () => {
    expect(signPreviewToken('')).toBe('')
    expect(verifyPreviewToken('', signPreviewToken(''))).toBe(false)
  })
})
