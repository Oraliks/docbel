// Source unique du secret servant à protéger le NRN belge (HMAC dédoublonnage
// dans dedupe.ts + chiffrement AES-256-GCM dans crypto-nrn.ts).
//
// Sécurité (SECURITY_QUEUE S1, loi du 8 août 1983) : secret dédié, AUCUN repli
// (ni constante hardcodée, ni dérivation depuis BETTER_AUTH_SECRET). La
// résolution est paresseuse — le secret n'est lu qu'à la première utilisation
// (= boot du runtime serverless), ce qui lève si la configuration est absente
// sans casser le build. `BOOKING_NRN_SECRET` doit être défini sur chaque
// environnement (présent sur Vercel Production).

let cached: string | null = null;

export function getNrnSecret(): string {
  if (cached) return cached;
  const secret = process.env.BOOKING_NRN_SECRET;
  if (!secret) {
    throw new Error(
      "BOOKING_NRN_SECRET manquant : secret dédié requis pour protéger le NRN " +
        "belge (loi du 8 août 1983). Définir BOOKING_NRN_SECRET dans l'environnement.",
    );
  }
  cached = secret;
  return secret;
}
