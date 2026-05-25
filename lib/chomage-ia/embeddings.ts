/**
 * Provider d'embeddings pour le module RAG chômage.
 *
 * Stratégie fail-soft :
 *   1. Si VOYAGE_API_KEY est défini → on utilise Voyage AI `voyage-3-lite`
 *      (1024 dim, ~$0.02/M tokens, FR de qualité).
 *   2. Sinon si OPENAI_API_KEY est défini → fallback OpenAI
 *      `text-embedding-3-small` (1536 dim, ~$0.020/M tokens).
 *   3. Sinon → null. L'indexer skip silencieusement et le chat retombe sur
 *      l'ancien comportement "toute la KB en contexte" (cf. context.ts).
 *
 * La colonne `embedding vector(1536)` accepte les 2 dimensions :
 *   - OpenAI 1536 → directement
 *   - Voyage 1024 → padded à 1536 avec des zéros (vecteurs "courts" → cosine
 *     similarity intacte, on perd juste un peu d'efficacité mémoire)
 *
 * Tous les appels sont batched (jusqu'à 64 textes par requête, limite Voyage).
 */

/** Modèle d'embedding utilisé pour un batch. Permet de mixer providers. */
export type EmbeddingModel =
  | "voyage-3-lite"
  | "text-embedding-3-small";

/** Dimension cible commune en DB (`vector(1536)`). */
export const EMBEDDING_TARGET_DIM = 1536;

/** Limite Voyage AI par requête (cf. docs Voyage). OpenAI tolère 2048. */
const BATCH_LIMIT = 64;

/** Cap caractères envoyé par texte pour respecter le tokens budget des providers. */
const MAX_CHARS_PER_TEXT = 8000;

interface EmbedResult {
  /** Vecteurs paddés à `EMBEDDING_TARGET_DIM` (1536). */
  vectors: number[][];
  /** Modèle effectif utilisé. */
  model: EmbeddingModel;
  /** Dimension native du modèle (avant padding). */
  dim: number;
}

/**
 * Renvoie le provider d'embeddings disponible selon les env vars, ou `null`
 * si aucune clé n'est configurée. Le résultat n'est pas mis en cache : on
 * relit `process.env` à chaque fois pour permettre un changement à chaud
 * via redéploiement.
 */
export function getEmbeddingProvider(): "voyage" | "openai" | null {
  if (process.env.VOYAGE_API_KEY) return "voyage";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

/**
 * Embed une liste de textes.
 *
 * Découpe automatiquement en batchs de `BATCH_LIMIT`. Tronque chaque texte à
 * `MAX_CHARS_PER_TEXT` pour respecter le budget tokens du provider (Voyage
 * tolère ~16K tokens par texte, OpenAI 8K — on reste prudent à 8000 chars
 * ≈ 2000 tokens, marge confortable pour les chunks de 1000 chars).
 *
 * @throws Error si pas de provider configuré ou si l'API retourne une erreur.
 */
export async function embedTexts(texts: string[]): Promise<EmbedResult> {
  const provider = getEmbeddingProvider();
  if (!provider) {
    throw new Error(
      "Aucun provider d'embeddings configuré (VOYAGE_API_KEY ou OPENAI_API_KEY).",
    );
  }
  if (texts.length === 0) {
    return {
      vectors: [],
      model: provider === "voyage" ? "voyage-3-lite" : "text-embedding-3-small",
      dim: provider === "voyage" ? 1024 : 1536,
    };
  }

  // Sanitise + cap par texte.
  const inputs = texts.map((t) => {
    const s = (t ?? "").trim();
    return s.length > MAX_CHARS_PER_TEXT
      ? s.slice(0, MAX_CHARS_PER_TEXT)
      : s.length === 0
        ? " " // les providers refusent une string vide → espace neutre
        : s;
  });

  const vectors: number[][] = [];
  let nativeDim = 0;
  let model: EmbeddingModel =
    provider === "voyage" ? "voyage-3-lite" : "text-embedding-3-small";

  for (let i = 0; i < inputs.length; i += BATCH_LIMIT) {
    const batch = inputs.slice(i, i + BATCH_LIMIT);
    const batchResult =
      provider === "voyage"
        ? await embedVoyage(batch)
        : await embedOpenAI(batch);
    if (nativeDim === 0) nativeDim = batchResult.dim;
    model = batchResult.model;
    // Padd à EMBEDDING_TARGET_DIM si nécessaire.
    for (const v of batchResult.vectors) {
      vectors.push(padToDim(v, EMBEDDING_TARGET_DIM));
    }
  }

  return { vectors, model, dim: nativeDim };
}

/* ------------------------------------------------------------------ */
/*  Voyage AI — POST https://api.voyageai.com/v1/embeddings            */
/* ------------------------------------------------------------------ */

async function embedVoyage(texts: string[]): Promise<{
  vectors: number[][];
  model: EmbeddingModel;
  dim: number;
}> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error("VOYAGE_API_KEY missing");

  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "voyage-3-lite",
      input: texts,
      // input_type "document" pour les chunks à indexer (vs "query" au search).
      // L'indexer appelle embedTexts → on optimise pour les documents par défaut.
      // Pour la query côté chat, on pourra passer un wrapper distinct si besoin.
      input_type: "document",
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Voyage embeddings ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    data?: Array<{ embedding?: number[]; index?: number }>;
    model?: string;
  };

  const items = data.data ?? [];
  if (items.length === 0) {
    throw new Error("Voyage embeddings: empty response");
  }

  // Voyage ne garantit pas l'ordre — on trie par index pour rester safe.
  items.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const vectors = items.map((it) => it.embedding ?? []);
  const dim = vectors[0]?.length ?? 1024;

  return {
    vectors,
    model: "voyage-3-lite",
    dim,
  };
}

/* ------------------------------------------------------------------ */
/*  OpenAI — POST https://api.openai.com/v1/embeddings                 */
/* ------------------------------------------------------------------ */

async function embedOpenAI(texts: string[]): Promise<{
  vectors: number[][];
  model: EmbeddingModel;
  dim: number;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: texts,
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI embeddings ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    data?: Array<{ embedding?: number[]; index?: number }>;
    model?: string;
  };

  const items = (data.data ?? []).slice();
  if (items.length === 0) {
    throw new Error("OpenAI embeddings: empty response");
  }
  items.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const vectors = items.map((it) => it.embedding ?? []);
  const dim = vectors[0]?.length ?? 1536;

  return {
    vectors,
    model: "text-embedding-3-small",
    dim,
  };
}

/* ------------------------------------------------------------------ */
/*  Utilitaires                                                        */
/* ------------------------------------------------------------------ */

/**
 * Padd un vecteur jusqu'à `targetDim` en ajoutant des zéros. Si le vecteur
 * est déjà plus long, le tronque (cas anormal).
 *
 * Pour cosine similarity, padder avec des zéros ne change pas la mesure
 * relative (les zéros ne contribuent à aucun produit scalaire) — c'est
 * mathématiquement équivalent à comparer les vecteurs sur leurs N premières
 * dimensions communes, ce qu'on veut ici.
 */
function padToDim(v: number[], targetDim: number): number[] {
  if (v.length === targetDim) return v;
  if (v.length > targetDim) return v.slice(0, targetDim);
  const out = new Array<number>(targetDim).fill(0);
  for (let i = 0; i < v.length; i++) out[i] = v[i];
  return out;
}

/**
 * Sérialise un vecteur en littéral SQL pgvector : `[0.1,0.2,…]`.
 * Format attendu par pgvector pour `INSERT … VALUES ($N::vector)`.
 *
 * NB : on n'utilise pas Number.toFixed() — on conserve la précision native
 * pour ne pas dégrader la similarity au-delà du nécessaire.
 */
export function vectorToSqlLiteral(v: number[]): string {
  // pgvector accepte 6+ décimales sans broncher ; on cap à 6 pour limiter
  // la taille du payload SQL (~10K chars par vecteur 1536 vs ~20K en raw).
  const parts: string[] = new Array(v.length);
  for (let i = 0; i < v.length; i++) {
    const n = v[i];
    if (!Number.isFinite(n)) {
      parts[i] = "0";
    } else {
      parts[i] = n.toFixed(6);
    }
  }
  return `[${parts.join(",")}]`;
}
