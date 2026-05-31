"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ClockIcon, ShieldCheckIcon, HelpCircleIcon, FileTextIcon, ChevronRightIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

/// Refonte de la page publique de remplissage de PDF :
/// - Header : breadcrumb + titre + badge organisme + pills meta.
/// - 2 colonnes : à gauche le formulaire, à droite un résumé live de la
///   saisie + une note RGPD rassurante.
export function DocumentPageLayout({ form, bundlePrefill, bundleRunId, bundleSlug }: Props) {
  const [values, setValues] = useState<FormPayload>({});
  const [locale, setLocale] = useState<Locale>(form.defaultLocale);

  const onValuesChange = useCallback((v: FormPayload) => setValues(v), []);
  const onLocaleChange = useCallback((l: Locale) => setLocale(l), []);

  // Estimation très simple du temps de remplissage : 30s par champ visible,
  // arrondi à la minute la plus proche. Min 2 min, max 30 min.
  const timeEstimate = useMemo(() => {
    const n = form.fields.length;
    const seconds = Math.max(2 * 60, Math.min(30 * 60, n * 30));
    const minutes = Math.round(seconds / 60);
    return `${minutes} min`;
  }, [form.fields.length]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-10">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1 text-xs text-muted-foreground" aria-label="Fil d'Ariane">
        <Link href="/" className="hover:text-foreground hover:underline">
          Accueil
        </Link>
        <ChevronRightIcon className="size-3" />
        {bundleSlug ? (
          <>
            <Link href={`/outils/bundles/${bundleSlug}`} className="hover:text-foreground hover:underline">
              Mon dossier
            </Link>
            <ChevronRightIcon className="size-3" />
          </>
        ) : (
          <>
            <Link href="/creer-ma-demande" className="hover:text-foreground hover:underline">
              Mes démarches
            </Link>
            <ChevronRightIcon className="size-3" />
          </>
        )}
        {form.issuer && (
          <>
            <span className="truncate">{form.issuer}</span>
            <ChevronRightIcon className="size-3" />
          </>
        )}
        <span className="truncate text-foreground">{form.title}</span>
      </nav>

      {/* En-tête */}
      <header className="mb-6 flex flex-col gap-3">
        {form.issuer && (
          <Badge
            variant="outline"
            className="w-fit border-[color:var(--glass-accent-deep,#7c3aed)] text-[11px] uppercase tracking-wide text-[color:var(--glass-accent-deep,#7c3aed)]"
          >
            {form.issuer}
          </Badge>
        )}
        <h1 className="text-2xl font-semibold sm:text-3xl">{form.title}</h1>
        {form.description && (
          <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
            {form.description}
          </p>
        )}

        {/* Pills meta */}
        <div className="mt-2 flex flex-wrap gap-3">
          <MetaPill icon={<ClockIcon className="size-4" />} label="Temps estimé" value={timeEstimate} />
          <MetaPill
            icon={<ShieldCheckIcon className="size-4" />}
            label="Sécurité"
            value="Vos données sont protégées"
          />
          <MetaPill
            icon={<HelpCircleIcon className="size-4" />}
            label="Besoin d'aide ?"
            value="Voir le guide"
            href="#aide"
          />
        </div>
      </header>

      {/* Layout principal — 2 colonnes sur desktop */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <PdfFormRunner
            form={form}
            bundlePrefill={bundlePrefill}
            bundleRunId={bundleRunId}
            onValuesChange={onValuesChange}
            onLocaleChange={onLocaleChange}
          />
        </div>

        <aside className="hidden flex-col gap-4 lg:flex">
          <SummarySidebar form={form} values={values} locale={locale} />
          <PrivacyNotice />
        </aside>
      </div>
    </div>
  );
}

function MetaPill({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  const inner = (
    <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="text-xs font-medium">{value}</span>
      </span>
    </div>
  );
  return href ? (
    <a href={href} className="hover:bg-muted/50">
      {inner}
    </a>
  ) : (
    inner
  );
}

function SummarySidebar({
  form,
  values,
  locale,
}: {
  form: PublicForm;
  values: FormPayload;
  locale: Locale;
}) {
  return (
    <Card className="sticky top-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileTextIcon className="size-4 text-muted-foreground" />
          Résumé du document
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Vérifiez les informations avant génération
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-xs">
        <KV label="Type de document" value={form.title} />
        {form.issuer && <KV label="Organisme" value={form.issuer} />}
        {form.fields.map((f) => (
          <KV
            key={f.id}
            label={loc(f.label, locale) || f.id}
            value={renderValue(f, values[f.id])}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={value ? "" : "italic text-muted-foreground"}>
        {value || "—"}
      </span>
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
    return typeof raw === "string" && raw.startsWith("data:image/")
      ? "✓ Signature enregistrée"
      : "";
  }
  return typeof raw === "string" || typeof raw === "number" ? String(raw) : "";
}

function PrivacyNotice() {
  return (
    <Card className="border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20">
      <CardContent className="flex flex-col gap-1 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <ShieldCheckIcon className="size-4" />
          Vos données restent privées
        </div>
        <p className="text-[11px] text-emerald-800/80 dark:text-emerald-200/80">
          Aucune donnée n&apos;est stockée. Le document est généré à la demande
          uniquement.
        </p>
      </CardContent>
    </Card>
  );
}
