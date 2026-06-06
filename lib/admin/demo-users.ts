/// Reconnaissance des comptes "demo" seedés par scripts/seed-demo-accounts.ts.
/// Centralise la convention email "demo+xxx@docbel.local" pour qu'on puisse
/// les protéger en écriture (cf. ensureWriteAllowed dans readonly-guard.ts)
/// sans dupliquer la regex partout.

const DEMO_EMAIL_RE = /^demo\+[^@]+@docbel\.local$/i

export function isDemoEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return DEMO_EMAIL_RE.test(email.trim())
}
