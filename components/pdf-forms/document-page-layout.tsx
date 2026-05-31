"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ClockIcon,
  ShieldCheckIcon,
  HelpCircleIcon,
  FileTextIcon,
  ChevronRightIcon,
  UserIcon,
  SparklesIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Card utilisé par la sidebar résumé
import { Badge } from "@/components/ui/badge";
import { GLASS_CARD } from "@/lib/glass-classes";
import { PdfFormRunner } from "./pdf-form-runner";
import type { PublicForm, PublicField } from "@/lib/pdf-forms/public-serializer";
import type { FormPayload, Locale } from "@/lib/pdf-forms/types";
import { isFullNameValue, loc } from "@/lib/pdf-forms/types";

interface Props {
  form: PublicForm;
  bundlePrefill?: Record<string, string>;
  bundleRunId?: string;
  bundleSlug?: string;
}

/// Page publique de remplissage d'un PDF — reprend le langage visuel "glass"
/// du reste du site (fond dégradé hérité de .glass-root, surfaces translucides)
/// et le layout du mockup : header riche avec illustration décorative, pills
/// meta, puis 2 colonnes (formulaire à gauche, résumé live à droite).
export function DocumentPageLayout({ form, bundlePrefill, bundleRunId, bundleSlug }: Props) {
  const [values, setValues] = useState<FormPayload>({});
  const [locale, setLocale] = useState<Locale>(form.defaultLocale);

  const onValuesChange = useCallback((v: FormPayload) => setValues(v), []);
  const onLocaleChange = useCallback((l: Locale) => setLocale(l), []);

  const timeEstimate = useMemo(() => {
    const seconds = Math.max(2 * 60, Math.min(30 * 60, form.fields.length * 30));
    return `${Math.round(seconds / 60)} min`;
  }, [form.fields.length]);

  // Abréviation pour l'illustration : "C32_Travailleur" → "C32".
  const docAbbrev = useMemo(() => {
    const head = form.title.split(/[_\s—–-]/)[0]?.trim() || form.title;
    return head.slice(0, 4).toUpperCase();
  }, [form.title]);

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-[color:var(--glass-ink-soft)]" aria-label="Fil d'Ariane">
        <Link href="/" className="hover:underline">Accueil</Link>
        <ChevronRightIcon className="size-3" />
        {bundleSlug ? (
          <>
            <Link href={`/outils/bundles/${bundleSlug}`} className="hover:underline">Mon dossier</Link>
            <ChevronRightIcon className="size-3" />
          </>
        ) : (
          <>
            <Link href="/creer-ma-demande" className="hover:underline">Mes démarches</Link>
            <ChevronRightIcon className="size-3" />
          </>
        )}
        {form.issuer && (
          <>
            <span>{form.issuer}</span>
            <ChevronRightIcon className="size-3" />
          </>
        )}
        <span className="truncate text-[color:var(--glass-ink)]">{form.title}</span>
      </nav>

      {/* En-tête : texte à gauche, illustration décorative à droite */}
      <header className="relative flex flex-col gap-4">
        <div className="flex flex-col gap-3 pr-0 lg:pr-48">
          {form.issuer && (
            <Badge
              variant="outline"
              className="w-fit border-[color:var(--glass-accent-deep)] bg-[color:var(--glass-pop-bg)] text-[11px] uppercase tracking-wide text-[color:var(--glass-accent-deep)]"
            >
              {form.issuer}
            </Badge>
          )}
          <h1 className="glass-display text-3xl font-semibold sm:text-4xl">{form.title}</h1>
          {form.description && (
            <p className="max-w-3xl text-sm text-[color:var(--glass-ink-soft)] sm:text-base">
              {form.description}
            </p>
          )}

          {/* Barre meta : une seule barre blanche avec 3 segments (cf. mockup) */}
          <div className="glass-surface mt-1 flex w-fit max-w-full flex-wrap items-center gap-1 rounded-2xl px-2 py-1.5">
            <MetaSegment icon={<ClockIcon className="size-4" />} label="Temps estimé" value={timeEstimate} />
            <span className="mx-1 hidden h-8 w-px bg-[color:var(--glass-border)] sm:block" />
            <MetaSegment icon={<ShieldCheckIcon className="size-4" />} label="Sécurité" value="Vos données sont protégées" />
            <span className="mx-1 hidden h-8 w-px bg-[color:var(--glass-border)] sm:block" />
            <MetaSegment icon={<HelpCircleIcon className="size-4" />} label="Besoin d'aide ?" value="Voir le guide" href="#aide" accent />
          </div>
        </div>

        {/* Illustration décorative — masquée sur mobile.
            Les libellés cyclés correspondent aux types de chômage temporaire
            du dossier actif ; ils seront un jour pilotés par la config du dossier. */}
        <DocIllustration
          abbrev={docAbbrev}
          cyclingLabels={[
            "Économique",
            "Action sociale",
            "Vacances annuelles",
            "Repos compensatoire",
            "Intempéries",
            "Accident technique",
            "Force majeure",
          ]}
        />
      </header>

      {/* Layout 2 colonnes */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <PdfFormRunner
            form={form}
            bundlePrefill={bundlePrefill}
            bundleRunId={bundleRunId}
            onValuesChange={onValuesChange}
            onLocaleChange={onLocaleChange}
          />
        </div>

        <aside className="flex flex-col gap-4">
          <SummarySidebar form={form} values={values} locale={locale} />
        </aside>
      </div>
    </div>
  );
}

// Libellés cyclés par défaut : les types de chômage temporaire du dossier
// actif. Exposés en prop pour rester génériques (futurs dossiers) et seront
// à terme pilotés par la config du dossier plutôt que codés en dur.
const DEFAULT_CYCLING_LABELS = [
  "Économique",
  "Action sociale",
  "Vacances annuelles",
  "Repos compensatoire",
  "Intempéries",
  "Accident technique",
  "Force majeure",
];

// Cadence : on commence rapide (~3,5 s) pour attirer l'œil, puis on ralentit
// à 5 s après quelques transitions "pour pas que ça charge trop le site".
const FAST_INTERVAL_MS = 3500;
const SLOW_INTERVAL_MS = 5000;
const FAST_TRANSITIONS = 3;

function DocIllustration({
  abbrev,
  cyclingLabels = DEFAULT_CYCLING_LABELS,
}: {
  abbrev: string;
  cyclingLabels?: string[];
}) {
  const [index, setIndex] = useState(0);
  // Nombre de swaps déjà effectués (sert à basculer rapide → lent).
  const swapsRef = useRef(0);

  useEffect(() => {
    if (cyclingLabels.length <= 1) return;

    // Respect de prefers-reduced-motion : pas de cycle, libellé statique.
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const schedule = () => {
      const delay = swapsRef.current < FAST_TRANSITIONS ? FAST_INTERVAL_MS : SLOW_INTERVAL_MS;
      timeoutId = setTimeout(() => {
        swapsRef.current += 1;
        setIndex((i) => (i + 1) % cyclingLabels.length);
        schedule();
      }, delay);
    };

    schedule();
    return () => clearTimeout(timeoutId);
  }, [cyclingLabels.length]);

  const label = cyclingLabels[index] ?? cyclingLabels[0] ?? "";

  return (
    <div className="pointer-events-none absolute -top-2 right-0 hidden h-36 w-44 lg:block" aria-hidden>
      <SparklesIcon className="absolute left-4 top-4 size-4 text-[color:var(--glass-accent-deep)] opacity-60" />
      <SparklesIcon className="absolute left-11 top-20 size-3 text-[color:var(--glass-accent-deep)] opacity-40" />
      <SparklesIcon className="absolute right-1 top-1 size-2.5 text-[color:var(--glass-accent-deep)] opacity-50" />
      {/* Feuille de document inclinée */}
      <div className="absolute right-11 top-3 flex h-32 w-28 rotate-6 flex-col gap-1.5 rounded-2xl bg-white p-3.5 shadow-xl ring-1 ring-black/5">
        <span className="h-1.5 w-16 rounded-full bg-[color:var(--glass-ink-faint)]" />
        <span className="h-1.5 w-11 rounded-full bg-[color:var(--glass-ink-faint)]" />
        <span className="h-1.5 w-12 rounded-full bg-[color:var(--glass-ink-faint)]" />
        {/* Badge abréviation + libellé cyclé du type de dossier */}
        <div className="mt-auto flex flex-col gap-1">
          <span className="w-fit rounded-lg bg-[color:var(--glass-accent-deep)] px-2 py-1 text-xs font-bold text-white">
            {abbrev}
          </span>
          {/* Crossfade : conteneur de hauteur fixe → aucun layout shift. */}
          <span className="relative block h-3 w-full overflow-hidden">
            <span
              key={index}
              className="glass-cycling-label absolute inset-0 truncate text-[10px] font-semibold leading-3 text-[color:var(--glass-accent-deep)]"
            >
              {label}
            </span>
          </span>
        </div>
      </div>
      {/* Pastille "personne" en bas à droite, en superposition */}
      <div className="absolute bottom-2 right-4 flex size-11 items-center justify-center rounded-2xl bg-[color:var(--glass-accent-deep)] shadow-xl">
        <UserIcon className="size-5 text-white" />
      </div>
      {/* Animation de crossfade ; désactivée si prefers-reduced-motion. */}
      <style>{`
        @keyframes glass-cycling-fade {
          from { opacity: 0; transform: translateY(3px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .glass-cycling-label {
          animation: glass-cycling-fade 360ms ease-out both;
        }
        @media (prefers-reduced-motion: reduce) {
          .glass-cycling-label { animation: none; }
        }
      `}</style>
    </div>
  );
}

function MetaSegment({
  icon,
  label,
  value,
  href,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
  accent?: boolean;
}) {
  const inner = (
    <div className="flex items-center gap-2.5 rounded-xl px-3 py-1.5">
      <span className="flex size-8 items-center justify-center rounded-full bg-[color:var(--glass-pop-bg)] text-[color:var(--glass-accent-deep)]">
        {icon}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[11px] text-[color:var(--glass-ink-faint)]">{label}</span>
        <span
          className={`text-[13px] font-semibold ${
            accent ? "text-[color:var(--glass-accent-deep)]" : "text-[color:var(--glass-ink)]"
          }`}
        >
          {value}
        </span>
      </span>
    </div>
  );
  return href ? (
    <a href={href} className="rounded-xl hover:bg-[color:var(--glass-pop-bg)]/40">
      {inner}
    </a>
  ) : (
    inner
  );
}

function SummarySidebar({ form, values, locale }: { form: PublicForm; values: FormPayload; locale: Locale }) {
  return (
    <Card className={`${GLASS_CARD} sticky top-6`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileTextIcon className="size-4 text-[color:var(--glass-accent-deep)]" />
          Résumé du document
        </CardTitle>
        <p className="text-[11px] text-[color:var(--glass-ink-soft)]">
          Vérifiez les informations avant génération
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-xs">
        <KV label="Type de document" value={form.title} highlight />
        {form.issuer && <KV label="Organisme" value={form.issuer} />}
        {form.fields.map((f) => (
          <KV key={f.id} label={loc(f.label, locale) || f.id} value={renderValue(f, values[f.id])} />
        ))}

        <div className="mt-2 flex items-start gap-2 rounded-xl bg-[color:var(--glass-pop-bg)] p-3">
          <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-[color:var(--glass-accent-deep)]" />
          <p className="text-[11px] text-[color:var(--glass-ink-soft)]">
            <span className="font-semibold text-[color:var(--glass-ink)]">Vos données restent privées.</span>{" "}
            Aucune donnée n&apos;est stockée. Le document est généré à la demande uniquement.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function KV({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-[color:var(--glass-ink-faint)]">{label}</span>
      {highlight ? (
        <Badge variant="secondary" className="w-fit text-[11px]">{value}</Badge>
      ) : (
        <span className={value ? "text-[color:var(--glass-ink)]" : "italic text-[color:var(--glass-ink-faint)]"}>
          {value || "—"}
        </span>
      )}
    </div>
  );
}

function renderValue(field: PublicField, raw: unknown): string {
  if (raw === undefined || raw === null) return "";
  if (field.type === "checkbox") return raw === true ? "Oui" : "Non";
  if (field.type === "fullname") {
    if (!isFullNameValue(raw)) return typeof raw === "string" ? raw : "";
    const first = (raw.first ?? "").trim();
    const last = (raw.last ?? "").trim();
    return field.nameOrder === "last-first"
      ? [last, first].filter(Boolean).join(" ")
      : [first, last].filter(Boolean).join(" ");
  }
  if (field.type === "signature") {
    return typeof raw === "string" && raw.trim() ? "✓ Signé numériquement" : "";
  }
  return typeof raw === "string" || typeof raw === "number" ? String(raw) : "";
}
