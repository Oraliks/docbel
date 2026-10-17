import { describe, expect, it, vi } from 'vitest'
import { withVerifiedBaremesIsolation } from '../../scripts/baremes-recipe-isolation'
describe('garde du cycle de recette PostgreSQL', () => {
  it('n’exécute ni recette ni nettoyage si le marqueur est refusé', async () => {
    const operations = { verify: vi.fn().mockRejectedValue(new Error('Marqueur refusé')), run: vi.fn(), cleanup: vi.fn(), disconnect: vi.fn() }
    await expect(withVerifiedBaremesIsolation(operations)).rejects.toThrow('Marqueur refusé')
    expect(operations.run).not.toHaveBeenCalled()
    expect(operations.cleanup).not.toHaveBeenCalled()
    expect(operations.disconnect).toHaveBeenCalledOnce()
  })
  it('nettoie après une panne de recette seulement lorsque l’isolation a été vérifiée', async () => {
    const operations = { verify: vi.fn(), run: vi.fn().mockRejectedValue(new Error('Panne injectée')), cleanup: vi.fn(), disconnect: vi.fn() }
    await expect(withVerifiedBaremesIsolation(operations)).rejects.toThrow('Panne injectée')
    expect(operations.cleanup).toHaveBeenCalledOnce()
    expect(operations.disconnect).toHaveBeenCalledOnce()
  })
  it('déconnecte même si le nettoyage échoue', async () => {
    const operations = { verify: vi.fn(), run: vi.fn().mockResolvedValue('done'), cleanup: vi.fn().mockRejectedValue(new Error('Cleanup failed')), disconnect: vi.fn() }
    await expect(withVerifiedBaremesIsolation(operations)).rejects.toThrow('Cleanup failed')
    expect(operations.disconnect).toHaveBeenCalledOnce()
  })
})
