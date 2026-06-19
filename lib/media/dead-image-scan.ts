// NB: pas de `import "server-only"` — cette lib est aussi importée par le
// script Node `scripts/scan-dead-images.ts` (tsx), où `server-only` lèverait.
// Les consommateurs client n'en importent que des TYPES (effacés à la compil).
import { prisma } from "@/lib/prisma";
import type { SmartImageType } from "@/components/ui/smart-image";

/**
 * Scan des images cassées (« link-rot ») sur tous les champs URL-image de la
 * base. Ping chaque URL (HEAD → GET en repli) et classe le résultat :
 *   - "dead"    : 4xx/5xx, timeout, erreur réseau → image cassée ;
 *   - "suspect" : 200 mais le contenu n'est pas une image (HTML/JSON — souvent
 *                 une redirection vers une page de login/erreur) ;
 *   - ok        : 2xx/3xx avec un content-type image (non listé dans le rapport).
 *
 * Le résultat est sérialisable (persisté dans AppSetting — pas de migration).
 * Aucune écriture en DB ici : le scan est en lecture seule.
 */

// ─── Sources ────────────────────────────────────────────────────────────────

export type ImageSourceId =
  | "news"
  | "organisme"
  | "training-cover"
  | "training-logo"
  | "booking-tenant"
  | "formation-org"
  | "user-avatar";

interface RawRef {
  sourceId: ImageSourceId;
  recordId: string;
  recordLabel: string;
  slug?: string;
  url: string;
}

interface SourceDef {
  id: ImageSourceId;
  label: string;
  /** Variante d'icône pour l'aperçu dans la table admin. */
  type: SmartImageType;
  /** Lien admin pour aller corriger l'enregistrement fautif. */
  adminUrl: (ref: { id: string; slug?: string }) => string;
  fetch: () => Promise<RawRef[]>;
}

/** Garde les chaînes non vides après trim, sinon undefined. */
function clean(value: string | null | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

const SOURCES: SourceDef[] = [
  {
    id: "news",
    label: "Actualités",
    type: "document",
    adminUrl: ({ id }) => `/admin/news/${id}`,
    fetch: async () => {
      const rows = await prisma.news.findMany({
        where: { image: { not: null } },
        select: { id: true, title: true, slug: true, image: true },
      });
      return rows.flatMap((r) => {
        const url = clean(r.image);
        return url
          ? [{ sourceId: "news" as const, recordId: r.id, recordLabel: r.title, slug: r.slug, url }]
          : [];
      });
    },
  },
  {
    id: "organisme",
    label: "Organismes",
    type: "partenaire",
    adminUrl: () => `/admin/pdf/organismes`,
    fetch: async () => {
      const rows = await prisma.organisme.findMany({
        where: { logoUrl: { not: null } },
        select: { id: true, name: true, code: true, logoUrl: true },
      });
      return rows.flatMap((r) => {
        const url = clean(r.logoUrl);
        return url
          ? [{ sourceId: "organisme" as const, recordId: r.id, recordLabel: r.name, slug: r.code, url }]
          : [];
      });
    },
  },
  {
    id: "training-cover",
    label: "Formations (couverture)",
    type: "formation",
    adminUrl: () => `/admin/formations`,
    fetch: async () => {
      const rows = await prisma.training.findMany({
        where: { coverImageUrl: { not: null } },
        select: { id: true, title: true, slug: true, coverImageUrl: true },
      });
      return rows.flatMap((r) => {
        const url = clean(r.coverImageUrl);
        return url
          ? [{ sourceId: "training-cover" as const, recordId: r.id, recordLabel: r.title, slug: r.slug, url }]
          : [];
      });
    },
  },
  {
    id: "training-logo",
    label: "Formations (logo)",
    type: "formation",
    adminUrl: () => `/admin/formations`,
    fetch: async () => {
      const rows = await prisma.training.findMany({
        where: { logoUrl: { not: null } },
        select: { id: true, title: true, slug: true, logoUrl: true },
      });
      return rows.flatMap((r) => {
        const url = clean(r.logoUrl);
        return url
          ? [{ sourceId: "training-logo" as const, recordId: r.id, recordLabel: r.title, slug: r.slug, url }]
          : [];
      });
    },
  },
  {
    id: "booking-tenant",
    label: "Rendez-vous (tenants)",
    type: "partenaire",
    adminUrl: ({ id }) => `/admin/booking/${id}`,
    fetch: async () => {
      const rows = await prisma.bookingTenant.findMany({
        where: { logoUrl: { not: null } },
        select: { id: true, name: true, slug: true, logoUrl: true },
      });
      return rows.flatMap((r) => {
        const url = clean(r.logoUrl);
        return url
          ? [{ sourceId: "booking-tenant" as const, recordId: r.id, recordLabel: r.name, slug: r.slug, url }]
          : [];
      });
    },
  },
  {
    id: "formation-org",
    label: "Organisations de formation",
    type: "partenaire",
    adminUrl: () => `/admin/formations/permissions`,
    fetch: async () => {
      const rows = await prisma.formationOrganization.findMany({
        where: { logoUrl: { not: null } },
        select: { id: true, name: true, slug: true, logoUrl: true },
      });
      return rows.flatMap((r) => {
        const url = clean(r.logoUrl);
        return url
          ? [{ sourceId: "formation-org" as const, recordId: r.id, recordLabel: r.name, slug: r.slug, url }]
          : [];
      });
    },
  },
  {
    id: "user-avatar",
    label: "Avatars utilisateurs",
    type: "avatar",
    adminUrl: ({ id }) => `/admin/users/${id}`,
    fetch: async () => {
      const rows = await prisma.user.findMany({
        where: { image: { not: null } },
        select: { id: true, name: true, email: true, image: true },
      });
      return rows.flatMap((r) => {
        const url = clean(r.image);
        return url
          ? [{ sourceId: "user-avatar" as const, recordId: r.id, recordLabel: r.name || r.email, url }]
          : [];
      });
    },
  },
];

// ─── Ping URL ─────────────────────────────────────────────────────────────────

export type CheckSeverity = "ok" | "suspect" | "dead";

export interface UrlCheck {
  severity: CheckSeverity;
  status: number | null;
  reason: string;
  contentType?: string | null;
}

const NON_IMAGE_CT = /^(text\/|application\/(json|xml|xhtml))/i;

async function checkUrl(
  rawUrl: string,
  opts: { baseUrl?: string; timeoutMs: number },
): Promise<UrlCheck> {
  const url = rawUrl.trim();

  // Images embarquées : toujours valides, rien à vérifier.
  if (url.startsWith("data:")) {
    return { severity: "ok", status: null, reason: "data-uri" };
  }

  // Résolution des URL relatives (fichiers servis par l'app) : possible
  // uniquement si on connaît l'origine. Sinon on ne peut pas conclure → on
  // marque "skipped" (jamais "dead" : éviter les faux positifs).
  let absolute = url;
  if (!/^https?:\/\//i.test(url)) {
    if (url.startsWith("/") && opts.baseUrl) {
      absolute = opts.baseUrl.replace(/\/$/, "") + url;
    } else {
      return { severity: "ok", status: null, reason: "skipped-local" };
    }
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  try {
    let res = await fetch(absolute, {
      method: "HEAD",
      redirect: "follow",
      signal: ctrl.signal,
    });
    // Beaucoup de serveurs refusent HEAD (405/501) ou le protègent (403) :
    // on retente en GET partiel (Range) — seul le statut nous intéresse.
    if ([403, 405, 501].includes(res.status)) {
      try {
        res.body?.cancel();
      } catch {
        /* noop */
      }
      res = await fetch(absolute, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        redirect: "follow",
        signal: ctrl.signal,
      });
    }

    const status = res.status;
    const contentType = res.headers.get("content-type");
    try {
      res.body?.cancel();
    } catch {
      /* noop */
    }

    if (status >= 400) {
      return { severity: "dead", status, reason: `http-${status}`, contentType };
    }
    // 2xx/3xx mais contenu non-image → souvent une page d'erreur/login servie
    // à la place de l'image.
    if (contentType && NON_IMAGE_CT.test(contentType)) {
      return { severity: "suspect", status, reason: "not-an-image", contentType };
    }
    return { severity: "ok", status, reason: "ok", contentType };
  } catch (err) {
    const aborted =
      err instanceof Error &&
      (err.name === "AbortError" || err.name === "TimeoutError");
    return {
      severity: "dead",
      status: null,
      reason: aborted ? "timeout" : "network",
    };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Pool de concurrence ───────────────────────────────────────────────────────

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (cursor < items.length) {
        const i = cursor++;
        results[i] = await fn(items[i], i);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

// ─── Résultat ──────────────────────────────────────────────────────────────────

export interface DeadImage {
  sourceId: ImageSourceId;
  sourceLabel: string;
  type: SmartImageType;
  recordId: string;
  recordLabel: string;
  slug?: string;
  url: string;
  status: number | null;
  reason: string;
  severity: Exclude<CheckSeverity, "ok">;
  adminUrl: string;
}

export interface SourceStat {
  id: ImageSourceId;
  label: string;
  checked: number;
  dead: number;
  suspect: number;
  /** Renseigné si la source n'a pas pu être lue (ex. modèle indisponible). */
  error?: string;
}

export interface ScanResult {
  scannedAt: string;
  durationMs: number;
  totalChecked: number;
  okCount: number;
  deadCount: number;
  suspectCount: number;
  bySource: SourceStat[];
  items: DeadImage[];
}

// ─── Scan ───────────────────────────────────────────────────────────────────────

export async function runDeadImageScan(opts?: {
  baseUrl?: string;
  concurrency?: number;
  timeoutMs?: number;
}): Promise<ScanResult> {
  const startedAt = Date.now();
  const concurrency = opts?.concurrency ?? 8;
  const timeoutMs = opts?.timeoutMs ?? 9000;

  // 1) Collecte des URLs (chaque source isolée : une lecture qui échoue ne
  //    casse pas tout le scan, elle est juste reportée en erreur de source).
  const refs: RawRef[] = [];
  const sourceErrors = new Map<ImageSourceId, string>();
  const sourceMeta = new Map<ImageSourceId, SourceDef>();
  for (const src of SOURCES) {
    sourceMeta.set(src.id, src);
    try {
      refs.push(...(await src.fetch()));
    } catch (err) {
      sourceErrors.set(src.id, err instanceof Error ? err.message : "lecture impossible");
    }
  }

  // 2) Ping en parallèle (pool borné).
  const checks = await mapPool(refs, concurrency, (ref) =>
    checkUrl(ref.url, { baseUrl: opts?.baseUrl, timeoutMs }),
  );

  // 3) Agrégation.
  const items: DeadImage[] = [];
  const stats = new Map<ImageSourceId, SourceStat>();
  for (const src of SOURCES) {
    stats.set(src.id, {
      id: src.id,
      label: src.label,
      checked: 0,
      dead: 0,
      suspect: 0,
      error: sourceErrors.get(src.id),
    });
  }

  let okCount = 0;
  refs.forEach((ref, i) => {
    const check = checks[i];
    const stat = stats.get(ref.sourceId)!;
    stat.checked++;
    if (check.severity === "ok") {
      okCount++;
      return;
    }
    stat[check.severity]++;
    const meta = sourceMeta.get(ref.sourceId)!;
    items.push({
      sourceId: ref.sourceId,
      sourceLabel: meta.label,
      type: meta.type,
      recordId: ref.recordId,
      recordLabel: ref.recordLabel,
      slug: ref.slug,
      url: ref.url,
      status: check.status,
      reason: check.reason,
      severity: check.severity,
      adminUrl: meta.adminUrl({ id: ref.recordId, slug: ref.slug }),
    });
  });

  // Morts d'abord, puis suspects ; regroupés par source pour la lisibilité.
  items.sort(
    (a, b) =>
      (a.severity === b.severity ? 0 : a.severity === "dead" ? -1 : 1) ||
      a.sourceLabel.localeCompare(b.sourceLabel),
  );

  return {
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    totalChecked: refs.length,
    okCount,
    deadCount: items.filter((i) => i.severity === "dead").length,
    suspectCount: items.filter((i) => i.severity === "suspect").length,
    bySource: [...stats.values()],
    items,
  };
}

// ─── Persistance (AppSetting — pas de migration) ────────────────────────────────

const SCAN_KEY = "media:dead-images:last-scan";

export interface StoredScan {
  result: ScanResult;
  updatedAt: string;
  updatedBy?: string | null;
}

export async function saveScanResult(
  result: ScanResult,
  updatedBy?: string | null,
): Promise<void> {
  const value = JSON.stringify(result);
  await prisma.appSetting.upsert({
    where: { key: SCAN_KEY },
    create: { key: SCAN_KEY, value, updatedBy: updatedBy ?? undefined },
    update: { value, updatedBy: updatedBy ?? undefined },
  });
}

export async function loadLastScan(): Promise<StoredScan | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: SCAN_KEY } });
  if (!row) return null;
  try {
    return {
      result: JSON.parse(row.value) as ScanResult,
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy,
    };
  } catch {
    return null;
  }
}
