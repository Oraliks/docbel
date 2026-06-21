/// Hachage des codes de reprise BELDOC (migration 53).
///
/// Le code en CLAIR n'est jamais stocké en base : on n'enregistre que son hash
/// HMAC déterministe, et la reprise se résout via ce hash. Le code clair n'est
/// affiché à l'utilisateur qu'UNE fois (à la création) — c'est la propriété de
/// sécurité voulue : un code volé en base est inexploitable, et un code ne peut
/// plus être renvoyé après coup (il faut le redémarrer).
///
/// HMAC déterministe (même pattern que `lib/booking/dedupe.ts`) pour que le
/// lookup reste une simple égalité indexée. Secret dérivé de la config auth.
///
/// ⚠️ Module SERVEUR (node:crypto) : ne jamais importer depuis un composant
/// client. Importé uniquement par les routes API et les scripts.

import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizeResumeCode } from "./resume-code";

const SECRET =
  process.env.RESUME_CODE_SECRET ||
  process.env.BETTER_AUTH_SECRET ||
  process.env.AUTH_SECRET ||
  "docbel-resume-code-fallback";

/// Hash HMAC-SHA256 (hex) du code NORMALISÉ. Déterministe → indexable.
export function hashResumeCode(code: string): string {
  return createHmac("sha256", SECRET)
    .update(normalizeResumeCode(code))
    .digest("hex");
}

/// Comparaison à temps constant de deux hash hex (anti timing-attack).
export function safeEqualHash(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
