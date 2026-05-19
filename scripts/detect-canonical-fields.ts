/// Script de détection des champs canoniques pour le seed de la bibliothèque
/// réutilisable. Lit chaque PDF de `seed-pdfs/FR/`, demande à Claude Sonnet 4.5
/// d'identifier les champs CITOYEN-FILLABLES, agrège entre documents, et écrit
/// un JSON de proposition qu'on review avant le seed.
///
/// Usage : `pnpm detect:canonical`
///
/// Coût estimé : ~$0.30-0.60 pour 8 PDFs (Sonnet vision via document input).

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as dotenv from "dotenv";

// Force le chargement de `.env.local` avec override : par défaut dotenv-cli (et
// dotenv lui-même) ne réécrivent PAS les variables d'environnement déjà
// définies par le shell ou l'outil parent. Certains contextes (Claude Code,
// CI) déclarent `ANTHROPIC_API_KEY=""` vide, ce qui ferait croire au script
// que la clé n'est pas présente. `override: true` réécrit toujours.
dotenv.config({ path: ".env.local", override: true });

const ROOT = path.resolve(process.cwd());
const PDFS_DIR = path.join(ROOT, "seed-pdfs", "FR");
const OUTPUT_FILE = path.join(ROOT, "seed-pdfs", "_canonical-fields-proposal.json");
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-5-20250929";

const SYSTEM_PROMPT = `Tu es un expert en formulaires administratifs belges (ONEM, Actiris, FOREM, CPAS, mutuelles, communes).

Tu vas recevoir un PDF d'un formulaire officiel belge. Identifie chaque ZONE DE SAISIE que le citoyen doit remplir lui-même.

**À INCLURE** :
- Lignes pointillées / underscores / cases vides où le citoyen écrit (nom, NISS, date, etc.)
- Cases à cocher pour des choix utilisateur (Travailleur / Apprenti, Oui / Non, etc.)
- Zones de signature (citoyen / travailleur uniquement, PAS celle de l'employeur si elle est sur le même doc)
- Champs de date, montants, IBAN, NISS, BCE, code postal, téléphone, email

**À EXCLURE** :
- Champs pré-remplis par l'institution (références légales, dates de règlement, numéros de formulaire)
- Champs réservés à un tiers (employeur, organisme de paiement, médecin) — ces zones existent sur le doc mais ne sont pas remplies par le citoyen
- Texte explicatif, instructions, notes de bas de page
- Logos et en-têtes

**RÈGLES SPÉCIALES** :
1. Si plusieurs cases à cocher sont MUTUELLEMENT EXCLUSIVES (genre "Travailleur OU Apprenti" — jamais les deux), regroupe-les en UN SEUL champ de type "select" avec ces options dans \`options\`. PAS deux champs checkbox séparés.
2. Si plusieurs cases à cocher peuvent être indépendantes (multi-select), garde-les comme champs checkbox séparés.
3. Pour les types belges natifs, utilise le type spécifique : "niss", "iban", "bce", "tva_be", "postal_be", "phone_be".
4. Pour signature : utilise le type "signature".
5. **TABLEAUX RÉPÉTÉS** : si le document contient une section tabulaire avec plusieurs lignes identiques en structure (ex. "PERSONNE 1", "PERSONNE 2", "PERSONNE 3", ou "PÉRIODE 1", "PÉRIODE 2"), retourne UN SEUL champ par COLONNE du tableau, PAS un champ par ligne. Le label doit être générique (sans "PERSONNE 1", "LIGNE 1", etc.).
6. **VARIANTES DU MÊME CHAMP** : si le même champ apparaît plusieurs fois sur le doc (genre "Date" répété en pied de chaque page), retourne UNE seule entrée — pas N copies.
7. Labels en français naturel, propres, **sans préfixes structurels** type "GRILLE", "SECTION A", "PAGE 2". Garde uniquement le NOM DU CHAMP.

**Format de réponse** : UNIQUEMENT du JSON valide selon ce schéma EXACT :
{
  "fields": [
    {
      "label": "Texte EXACT du label tel qu'écrit sur le PDF (nettoyé des '(*)', ':', '____')",
      "type": "text" | "textarea" | "number" | "date" | "checkbox" | "select" | "niss" | "iban" | "postal_be" | "tva_be" | "bce" | "phone_be" | "signature",
      "category": "identity" | "contact" | "address" | "bank" | "employer" | "social" | "document" | "other",
      "options": [{"value": "...", "label": "..."}] OU null (uniquement pour type=select),
      "defaultWidthPoints": <number, largeur typique en points PDF — text 100-400, dates 60-80, checkbox 12-16, signature 150>,
      "defaultHeightPoints": <number, hauteur typique — text 14, textarea 50-100, checkbox 12-16, signature 40>,
      "helpText": "Aide courte citoyen-friendly (≤80 chars) ou null",
      "required": true | false,
      "belgianValidator": "niss" | "iban" | "tva" | "bce" | "postal" | "phone" | null,
      "page": <numéro de page 1-indexed>,
      "notes": "Précisions éventuelles (ex. 'mutuellement exclusif avec...', 'lookup BCE auto-remplit ce champ', etc.) ou null"
    }
  ]
}

Pas de markdown, pas de texte avant/après — juste le JSON.`;

interface DetectedField {
  label: string;
  type: string;
  category: string;
  options: { value: string; label: string }[] | null;
  defaultWidthPoints: number;
  defaultHeightPoints: number;
  helpText: string | null;
  required: boolean;
  belgianValidator: string | null;
  page: number;
  notes: string | null;
}

interface ApiUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

interface PerDocumentResult {
  pdfName: string;
  fields: DetectedField[];
  durationMs: number;
  usage?: ApiUsage;
  error?: string;
}

interface ConsolidatedField {
  /// Label canonique consolidé (le plus fréquent ou le plus complet parmi les variantes)
  canonicalLabel: string;
  type: string;
  category: string;
  options: { value: string; label: string }[] | null;
  /// Médianes / moyennes calculées depuis les occurrences
  defaultWidthPoints: number;
  defaultHeightPoints: number;
  helpText: string | null;
  required: boolean;
  belgianValidator: string | null;
  /// Documents où ce champ a été détecté
  sources: string[];
  occurrences: number;
  /// Variantes de label rencontrées (pour debug et fuzzy match futur)
  labelVariants: string[];
  notes: string[];
}

// ============================================================================
// Helpers
// ============================================================================

function logProgress(msg: string) {
  process.stdout.write(`${new Date().toLocaleTimeString()}  ${msg}\n`);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function normalizeLabel(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function modeOrFirst<T>(values: T[]): T | undefined {
  if (values.length === 0) return undefined;
  const counts = new Map<string, { value: T; count: number }>();
  for (const v of values) {
    const key = JSON.stringify(v);
    const e = counts.get(key);
    if (e) e.count++;
    else counts.set(key, { value: v, count: 1 });
  }
  let best: { value: T; count: number } | undefined;
  for (const e of counts.values()) {
    if (!best || e.count > best.count) best = e;
  }
  return best?.value;
}

// ============================================================================
// Anthropic API call
// ============================================================================

async function detectFieldsInPdf(
  pdfPath: string
): Promise<{ fields: DetectedField[]; usage?: ApiUsage; durationMs: number }> {
  const buffer = await fs.readFile(pdfPath);
  const base64 = buffer.toString("base64");
  const pdfName = path.basename(pdfPath);

  const userMessage = `Document : ${pdfName}

Analyse ce PDF et liste TOUS les champs que le citoyen doit remplir lui-même, en respectant le schéma JSON strict du system prompt.`;

  const startedAt = Date.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          // Cache le system prompt entre les appels (gros gain $$ sur 8 PDFs)
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: base64 },
            },
            { type: "text", text: userMessage },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(240_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const replyText = (data?.content?.[0]?.text || "").trim();
  const durationMs = Date.now() - startedAt;
  const usage: ApiUsage | undefined = data?.usage;

  // Extract JSON
  const match = replyText.match(/\{[\s\S]*\}/);
  const jsonStr = match ? match[0] : replyText;
  let parsed: { fields?: unknown };
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(`JSON parse failed: ${err}. Reply: ${replyText.slice(0, 500)}`);
  }

  const rawFields = Array.isArray(parsed.fields) ? parsed.fields : [];
  const fields: DetectedField[] = [];
  for (const raw of rawFields) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.label !== "string" || typeof r.type !== "string") continue;
    fields.push({
      label: r.label,
      type: r.type,
      category: typeof r.category === "string" ? r.category : "other",
      options: Array.isArray(r.options)
        ? (r.options as { value: string; label: string }[])
        : null,
      defaultWidthPoints:
        typeof r.defaultWidthPoints === "number" ? r.defaultWidthPoints : 150,
      defaultHeightPoints:
        typeof r.defaultHeightPoints === "number" ? r.defaultHeightPoints : 14,
      helpText: typeof r.helpText === "string" ? r.helpText : null,
      required: typeof r.required === "boolean" ? r.required : false,
      belgianValidator:
        typeof r.belgianValidator === "string" ? r.belgianValidator : null,
      page: typeof r.page === "number" ? r.page : 1,
      notes: typeof r.notes === "string" ? r.notes : null,
    });
  }

  return { fields, usage, durationMs };
}

// ============================================================================
// Consolidation cross-documents (fuzzy dedupe)
// ============================================================================

function consolidate(perDoc: PerDocumentResult[]): ConsolidatedField[] {
  // Aplatit : (field, sourcePdf)
  const all: Array<{ field: DetectedField; source: string }> = [];
  for (const doc of perDoc) {
    for (const f of doc.fields) {
      all.push({ field: f, source: doc.pdfName });
    }
  }

  // Groupe par (normalized label + type) avec fuzzy match
  // Threshold 25% Levenshtein → tolère "Numéro NISS" vs "Numéro de NISS"
  const groups: Array<{
    representative: DetectedField;
    members: Array<{ field: DetectedField; source: string }>;
  }> = [];

  for (const item of all) {
    const normLabel = normalizeLabel(item.field.label);
    if (normLabel.length < 2) continue;

    // Cherche un groupe compatible (même type + label proche)
    let matched: (typeof groups)[number] | null = null;
    for (const g of groups) {
      if (g.representative.type !== item.field.type) continue;
      const normRep = normalizeLabel(g.representative.label);
      const dist = levenshtein(normLabel, normRep);
      const maxLen = Math.max(normLabel.length, normRep.length);
      const ratio = dist / maxLen;
      if (ratio <= 0.25) {
        matched = g;
        break;
      }
    }

    if (matched) {
      matched.members.push(item);
    } else {
      groups.push({
        representative: item.field,
        members: [item],
      });
    }
  }

  // Construit le ConsolidatedField pour chaque groupe
  const consolidated: ConsolidatedField[] = groups.map((g) => {
    const labels = g.members.map((m) => m.field.label);
    const sources = Array.from(new Set(g.members.map((m) => m.source)));
    const helpTexts = g.members
      .map((m) => m.field.helpText)
      .filter((h): h is string => !!h);
    const allNotes = g.members
      .map((m) => m.field.notes)
      .filter((n): n is string => !!n);

    // Choisit le label canonique : le plus FRÉQUENT, et à fréquence égale le plus LONG
    const labelFreq = new Map<string, number>();
    for (const l of labels) labelFreq.set(l, (labelFreq.get(l) || 0) + 1);
    let canonicalLabel = labels[0];
    let bestFreq = -1;
    for (const [l, f] of labelFreq) {
      if (f > bestFreq || (f === bestFreq && l.length > canonicalLabel.length)) {
        canonicalLabel = l;
        bestFreq = f;
      }
    }

    return {
      canonicalLabel,
      type: g.representative.type,
      category: modeOrFirst(g.members.map((m) => m.field.category)) ?? "other",
      options:
        g.representative.type === "select"
          ? g.members.find((m) => m.field.options)?.field.options ?? null
          : null,
      defaultWidthPoints: Math.round(
        median(g.members.map((m) => m.field.defaultWidthPoints))
      ),
      defaultHeightPoints: Math.round(
        median(g.members.map((m) => m.field.defaultHeightPoints))
      ),
      helpText: helpTexts.length > 0 ? helpTexts[0] : null, // premier non-null
      required: g.members.some((m) => m.field.required), // required si au moins un l'est
      belgianValidator: modeOrFirst(
        g.members
          .map((m) => m.field.belgianValidator)
          .filter((v): v is string => !!v)
      ) ?? null,
      sources,
      occurrences: g.members.length,
      labelVariants: Array.from(new Set(labels)),
      notes: Array.from(new Set(allNotes)),
    };
  });

  // Trie par occurrences décroissantes (les plus communs en haut)
  consolidated.sort((a, b) => b.occurrences - a.occurrences);
  return consolidated;
}

// ============================================================================
// Coût estimation (en USD, basé sur tarifs Anthropic publics)
// ============================================================================

const PRICING = {
  // Sonnet 4.5 — $3 / 1M input tokens, $15 / 1M output, $3.75 cache write, $0.30 cache read
  inputPerM: 3,
  outputPerM: 15,
  cacheReadPerM: 0.3,
  cacheWritePerM: 3.75,
};

function estimateCostUsd(usages: ApiUsage[]): number {
  let total = 0;
  for (const u of usages) {
    const input = u.input_tokens ?? 0;
    const output = u.output_tokens ?? 0;
    const cacheRead = u.cache_read_input_tokens ?? 0;
    const cacheWrite = u.cache_creation_input_tokens ?? 0;
    total += (input * PRICING.inputPerM) / 1_000_000;
    total += (output * PRICING.outputPerM) / 1_000_000;
    total += (cacheRead * PRICING.cacheReadPerM) / 1_000_000;
    total += (cacheWrite * PRICING.cacheWritePerM) / 1_000_000;
  }
  return total;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  if (!ANTHROPIC_API_KEY) {
    console.error("❌ ANTHROPIC_API_KEY non configurée dans .env.local");
    process.exit(1);
  }

  let pdfFiles: string[];
  try {
    const all = await fs.readdir(PDFS_DIR);
    pdfFiles = all.filter((f) => f.toLowerCase().endsWith(".pdf")).sort();
  } catch (err) {
    console.error(`❌ Dossier introuvable : ${PDFS_DIR}`, err);
    process.exit(1);
  }

  if (pdfFiles.length === 0) {
    console.error(`❌ Aucun PDF dans ${PDFS_DIR}`);
    process.exit(1);
  }

  logProgress(`🔍 ${pdfFiles.length} PDF(s) à analyser dans ${PDFS_DIR}`);
  logProgress(`📡 Modèle : ${MODEL}`);
  logProgress("");

  const perDoc: PerDocumentResult[] = [];
  for (let i = 0; i < pdfFiles.length; i++) {
    const file = pdfFiles[i];
    const fullPath = path.join(PDFS_DIR, file);
    logProgress(`[${i + 1}/${pdfFiles.length}] ${file} — analyse en cours…`);

    try {
      const { fields, usage, durationMs } = await detectFieldsInPdf(fullPath);
      perDoc.push({ pdfName: file, fields, usage, durationMs });
      const cacheInfo = usage?.cache_read_input_tokens
        ? ` · cache:${usage.cache_read_input_tokens}`
        : "";
      logProgress(
        `   ✓ ${fields.length} champ(s) détecté(s) en ${Math.round(durationMs / 1000)}s · ${usage?.input_tokens ?? "?"} in / ${usage?.output_tokens ?? "?"} out${cacheInfo}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      perDoc.push({ pdfName: file, fields: [], durationMs: 0, error: msg });
      logProgress(`   ✗ Erreur : ${msg}`);
    }
  }

  logProgress("");
  logProgress("📊 Consolidation cross-documents…");
  const consolidated = consolidate(perDoc);
  logProgress(
    `   ${consolidated.length} champ(s) canoniques après dédoublonnage fuzzy`
  );

  const usages = perDoc.map((p) => p.usage).filter((u): u is ApiUsage => !!u);
  const totalCost = estimateCostUsd(usages);
  logProgress("");
  logProgress(`💰 Coût estimé : $${totalCost.toFixed(3)} USD`);
  logProgress("");

  const output = {
    generatedAt: new Date().toISOString(),
    model: MODEL,
    perDocument: perDoc,
    consolidated,
    summary: {
      pdfsAnalyzed: pdfFiles.length,
      successfulPdfs: perDoc.filter((p) => !p.error).length,
      failedPdfs: perDoc.filter((p) => p.error).length,
      totalFieldsDetected: perDoc.reduce((s, p) => s + p.fields.length, 0),
      uniqueCanonicalFields: consolidated.length,
      estimatedCostUsd: Number(totalCost.toFixed(4)),
      totalUsage: {
        inputTokens: usages.reduce((s, u) => s + (u.input_tokens ?? 0), 0),
        outputTokens: usages.reduce((s, u) => s + (u.output_tokens ?? 0), 0),
        cacheReadTokens: usages.reduce(
          (s, u) => s + (u.cache_read_input_tokens ?? 0),
          0
        ),
        cacheWriteTokens: usages.reduce(
          (s, u) => s + (u.cache_creation_input_tokens ?? 0),
          0
        ),
      },
    },
  };

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf-8");
  logProgress(`✅ Première passe écrite : ${OUTPUT_FILE}`);
  logProgress("");

  // ===== Deuxième passe : consolidation IA finale =====
  logProgress("🧠 Passe 2 : consolidation IA finale (Claude Sonnet)…");
  try {
    const finalLibrary = await consolidateWithAi(consolidated);
    output.summary.estimatedCostUsd =
      Number((totalCost + finalLibrary.costUsd).toFixed(4));
    // Réécrit le JSON avec le résultat consolidé
    const finalOutput = { ...output, finalLibrary: finalLibrary.fields };
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(finalOutput, null, 2), "utf-8");
    logProgress(
      `   ✓ ${finalLibrary.fields.length} champ(s) dans la bibliothèque finale · coût total $${finalOutput.summary.estimatedCostUsd}`
    );
    logProgress("");
    logProgress(`Bibliothèque finale par catégorie :`);
    const byCat = new Map<string, number>();
    for (const f of finalLibrary.fields) {
      byCat.set(f.category, (byCat.get(f.category) ?? 0) + 1);
    }
    for (const [cat, count] of [...byCat.entries()].sort((a, b) => b[1] - a[1])) {
      logProgress(`   ${cat.padEnd(12)} ${count}`);
    }
  } catch (err) {
    logProgress(
      `   ✗ Échec consolidation IA : ${err instanceof Error ? err.message : String(err)}`
    );
    logProgress("   (la liste fuzzy-deduped reste dispo dans 'consolidated')");
  }
}

// ============================================================================
// Consolidation IA — passe 2
// ============================================================================

interface FinalLibraryField {
  canonicalName: string; // ID slug (genre "niss-belge", "prenom-nom-complet")
  label: string; // Label affiché par défaut quand placé sur PDF
  type: string;
  category: string;
  options: { value: string; label: string }[] | null;
  defaultWidthPoints: number;
  defaultHeightPoints: number;
  helpText: string | null;
  belgianValidator: string | null;
  popular: boolean; // À mettre dans la palette rapide
  derivedFrom: string[]; // Variantes de label qui mappent vers ce canonique
  notes: string | null;
}

const CONSOLIDATION_SYSTEM = `Tu es un architecte logiciel qui construit une bibliothèque de champs réutilisables pour un système de génération de documents administratifs belges.

Tu vas recevoir une liste de champs DÉTECTÉS sur plusieurs PDFs officiels belges. Plusieurs sont des doublons ou des variantes du même concept (genre "Prénom et nom" / "NOM et Prénom" / "Nom complet").

Ta mission : produire une **bibliothèque canonique consolidée** de ~30-50 champs réutilisables, en :
1. **Fusionnant les variantes** du même concept (un seul canonique par concept)
2. **Standardisant les labels** (français propre, sans préfixes structurels comme "GRILLE 1 -")
3. **Définissant les dimensions optimales** (largeur/hauteur en points PDF)
4. **Catégorisant** : identity / contact / address / bank / employer / social / document / other
5. **Marquant les ~10 plus communs comme popular=true** (pour la palette rapide)
6. **Générant un canonicalName slug** kebab-case unique par champ (ex. "niss-belge", "prenom-nom-complet", "iban-international")

**Format de réponse** : UNIQUEMENT du JSON valide :
{
  "fields": [
    {
      "canonicalName": "niss-belge",
      "label": "Numéro de Registre national (NISS)",
      "type": "niss",
      "category": "identity",
      "options": null,
      "defaultWidthPoints": 150,
      "defaultHeightPoints": 14,
      "helpText": "Trouvez votre NISS sur votre carte d'identité (11 chiffres)",
      "belgianValidator": "niss",
      "popular": true,
      "derivedFrom": ["Numéro de Registre national (NISS)", "NISS", "N° NISS"],
      "notes": "Validation 18 ans et plus selon date encodée dans le NISS"
    }
  ]
}

**Règles** :
- Préfère 30-50 canoniques propres à 100+ champs redondants. Sois SÉLECTIF.
- Pour les champs très spécifiques à UN seul document (genre "Indication dans les registres pour PERSONNE 1"), regroupe-les sous des canoniques génériques (ex. "Nom et prénom d'un proche") OU exclus-les si trop spécifiques.
- Les champs tabulaires identifiés (GRILLE, SECTION, PERSONNE N) doivent devenir UN canonique générique.
- popular=true uniquement pour : Prénom, Nom, NISS, Date de naissance, Email, Téléphone, Adresse, IBAN, Signature, Date de signature, Code postal, Ville, BCE. Max 12 popular.

Pas de markdown, pas de texte avant/après — juste le JSON.`;

async function consolidateWithAi(
  consolidated: ConsolidatedField[]
): Promise<{ fields: FinalLibraryField[]; costUsd: number }> {
  const rawList = consolidated.map((c) => ({
    label: c.canonicalLabel,
    type: c.type,
    category: c.category,
    options: c.options,
    defaultWidthPoints: c.defaultWidthPoints,
    defaultHeightPoints: c.defaultHeightPoints,
    occurrences: c.occurrences,
    sources: c.sources,
    labelVariants: c.labelVariants,
    notes: c.notes,
  }));

  const userMessage = `Voici ${rawList.length} champs détectés sur les PDFs officiels belges :

\`\`\`json
${JSON.stringify(rawList, null, 2)}
\`\`\`

Consolide en ~30-50 canoniques propres selon le system prompt. JSON strict uniquement.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      system: [
        { type: "text", text: CONSOLIDATION_SYSTEM, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userMessage }],
    }),
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const replyText = (data?.content?.[0]?.text || "").trim();
  const match = replyText.match(/\{[\s\S]*\}/);
  const jsonStr = match ? match[0] : replyText;
  const parsed = JSON.parse(jsonStr);
  if (!Array.isArray(parsed.fields)) {
    throw new Error("Réponse IA mal formée (pas de tableau 'fields')");
  }

  const usage: ApiUsage = data?.usage || {};
  const cost = estimateCostUsd([usage]);
  return { fields: parsed.fields, costUsd: cost };
}

main().catch((err) => {
  console.error("❌ Erreur fatale :", err);
  process.exit(1);
});
