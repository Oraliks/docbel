import Link from "next/link";
import { ArrowLeft, ExternalLink, MoreHorizontal } from "lucide-react";
import {
  type CalcMethodology,
  RELIABILITY_LABELS,
  RELIABILITY_COLORS,
} from "@/lib/calculators/_methodology";
import { CountryFlag } from "@/components/docbel/country-flag";

/**
 * Mapping label → code ISO2 pour les badges qui correspondent à un pays
 * connu. On préfixe le label par un drapeau SVG via CountryFlag (Windows
 * ne ship pas les emojis drapeaux regional indicators, donc on évite
 * l'emoji texte qui se rendrait "BE").
 */
const COUNTRY_BADGE_TO_ISO: Record<string, string> = {
  Belgique: "be",
  France: "fr",
  "Pays-Bas": "nl",
  Allemagne: "de",
  Luxembourg: "lu",
};

/**
 * Données minimales du Tool DB nécessaires au header (status badge,
 * informations éditées). Optionnel — si absent, le badge tombe sur
 * `BROUILLON` et on n'affiche pas le titre éditable.
 */
export interface HeaderToolMeta {
  name?: string;
  description?: string | null;
  active?: boolean;
}

interface MethodologyHeaderProps {
  data: CalcMethodology;
  dbTool?: HeaderToolMeta | null;
  /**
   * URL publique de l'outil (ex: `/outils/{slug}`). Si non fournie, on
   * fallback sur `data.slug`.
   */
  publicUrl?: string;
}

/**
 * Header de la fiche méthodologie admin (zone 1/3 du design).
 *
 * Server component — pas d'interactivité. Affiche :
 *   - Breadcrumb "← Tous les calculateurs / {titre}"
 *   - Titre H1 + badges (status, année, région, badges custom)
 *   - Description (pitch)
 *   - Bouton "Voir l'outil public" + placeholder "Actions" (à câbler plus tard)
 */
export function MethodologyHeader({
  data,
  dbTool,
  publicUrl,
}: MethodologyHeaderProps) {
  const url = publicUrl ?? `/outils/${data.slug}`;
  // Status: dbTool.active === false → DÉSACTIVÉ, sinon PUBLIÉ (faute de
  // colonne `published` distincte pour l'instant).
  const isPublished = dbTool?.active !== false;
  const statusLabel = isPublished ? "Publié" : "Désactivé";
  const statusColor = isPublished ? "#10b981" : "#94a3b8";
  const reliabilityColor = RELIABILITY_COLORS[data.reliability];
  const reliabilityLabel = RELIABILITY_LABELS[data.reliability];

  return (
    <header className="flex flex-col gap-4">
      {/* Breadcrumb -------------------------------------------------- */}
      <nav className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
        <Link
          href="/admin/chomage/outils/calculateurs"
          className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Tous les calculateurs
        </Link>
        <span>/</span>
        <span className="truncate">{data.title}</span>
      </nav>

      {/* Titre + badges + actions ------------------------------------ */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold leading-tight">{data.title}</h1>
            {/* Badge status (publié/désactivé) */}
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
              style={{
                background: `${statusColor}1A`,
                color: statusColor,
                border: `1px solid ${statusColor}40`,
              }}
            >
              {statusLabel}
            </span>
            {/* Badge année */}
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {data.year}
            </span>
            {/* Badge fiabilité (réutilisé du méthodology-card) */}
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
              style={{
                background: `${reliabilityColor}1A`,
                color: reliabilityColor,
                border: `1px solid ${reliabilityColor}40`,
              }}
            >
              {reliabilityLabel}
            </span>
            {/* Badges custom de la methodology — préfixe drapeau si pays connu */}
            {(data.badges ?? []).map((b) => {
              const iso = COUNTRY_BADGE_TO_ISO[b];
              return (
                <span
                  key={b}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
                >
                  {iso ? (
                    <CountryFlag code={iso} size={12} country={b} />
                  ) : null}
                  {b}
                </span>
              );
            })}
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {data.pitch}
          </p>
        </div>

        {/* Actions ---------------------------------------------------- */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Placeholder "Actions" — dropdown vide pour MVP */}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[12.5px] font-semibold text-foreground hover:bg-muted disabled:opacity-50"
            disabled
            title="Bientôt — actions admin (dupliquer, archiver, exporter…)"
          >
            Actions
            <MoreHorizontal className="size-3.5" />
          </button>
          {/* Voir public */}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-[12.5px] font-semibold text-primary hover:bg-primary/20"
          >
            Voir l&apos;outil
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>
    </header>
  );
}
