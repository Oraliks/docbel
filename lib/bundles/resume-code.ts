/// Génération et validation des codes de reprise pour les BundleRun.
///
/// Format : `BELDOC-XXXX-XXXX` où X est un caractère alphanumérique
/// (sans caractères ambigus : 0/O, 1/I/L confondus).
///
/// Le code est :
/// - lisible (groupes de 4 séparés par des tirets)
/// - dictable au téléphone (alphabet réduit, pas de casse sensible)
/// - non-collisionnable raisonnablement (~32^8 = 1.1 × 10^12 combinaisons)
/// - lié à un `BundleRun.id` en base via une colonne unique indexée
///
/// **Ne pas utiliser comme secret cryptographique.** Le code donne accès à un
/// dossier en cours mais aucune donnée nominative n'y est attachée (anonyme),
/// et le code expire (par défaut TTL = 30 jours).

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // exclut 0, O, I, 1, L
const PREFIX = "BELDOC";
const GROUP_LENGTH = 4;
const GROUP_COUNT = 2;
export const RESUME_CODE_DEFAULT_TTL_DAYS = 30;

function pickChar(): string {
  return ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
}

function pickGroup(): string {
  let s = "";
  for (let i = 0; i < GROUP_LENGTH; i++) s += pickChar();
  return s;
}

/// Génère un nouveau code de reprise (non garanti unique — vérifier en base).
export function generateResumeCode(): string {
  const groups: string[] = [];
  for (let i = 0; i < GROUP_COUNT; i++) groups.push(pickGroup());
  return `${PREFIX}-${groups.join("-")}`;
}

/// Génère un code unique en base (retry jusqu'à 5 fois).
/// Reçoit une fonction `exists(code)` qui vérifie la présence en BDD.
export async function generateUniqueResumeCode(
  exists: (code: string) => Promise<boolean>,
  maxRetries = 5
): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const code = generateResumeCode();
    if (!(await exists(code))) return code;
  }
  throw new Error(
    `Impossible de générer un code de reprise unique après ${maxRetries} essais.`
  );
}

/// Normalise un code saisi par l'utilisateur (uppercase, retire les espaces,
/// re-formate avec les tirets). Tolère des codes saisis sans tirets.
export function normalizeResumeCode(input: string): string {
  const cleaned = input
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9-]/g, "");
  // Si pas de tirets, on essaie de reformater BELDOCXXXXYYYY → BELDOC-XXXX-YYYY
  if (!cleaned.includes("-") && cleaned.startsWith(PREFIX)) {
    const rest = cleaned.slice(PREFIX.length);
    if (rest.length === GROUP_LENGTH * GROUP_COUNT) {
      const groups: string[] = [];
      for (let i = 0; i < GROUP_COUNT; i++) {
        groups.push(rest.slice(i * GROUP_LENGTH, (i + 1) * GROUP_LENGTH));
      }
      return `${PREFIX}-${groups.join("-")}`;
    }
  }
  return cleaned;
}

const RESUME_CODE_PATTERN = new RegExp(
  `^${PREFIX}-[${ALPHABET}]{${GROUP_LENGTH}}-[${ALPHABET}]{${GROUP_LENGTH}}$`
);

/// Vérifie qu'un code respecte le format attendu (après normalisation).
export function isValidResumeCodeFormat(code: string): boolean {
  return RESUME_CODE_PATTERN.test(code);
}

/// Calcule la date d'expiration par défaut.
export function defaultResumeCodeExpiresAt(now = new Date()): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + RESUME_CODE_DEFAULT_TTL_DAYS);
  return d;
}
