/** Aucune écriture, y compris de nettoyage, n'est permise avant vérification. */
export async function withVerifiedBaremesIsolation<T>(operations: {
  verify: () => Promise<void>
  run: () => Promise<T>
  cleanup: () => Promise<void>
  disconnect: () => Promise<void>
}): Promise<T> {
  let verified = false
  try {
    await operations.verify()
    verified = true
    return await operations.run()
  } finally {
    try {
      if (verified) await operations.cleanup()
    } finally {
      await operations.disconnect()
    }
  }
}
