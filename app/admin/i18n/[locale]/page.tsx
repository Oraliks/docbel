import { redirect } from "next/navigation";
import { requireAdminAuth } from "@/lib/auth-check";
import { LocaleTranslationsManager } from "./locale-translations-manager";
import "flag-icons/css/flag-icons.min.css";

export const dynamic = "force-dynamic";

const SUPPORTED = ["nl", "en", "de", "ar", "tr", "ro", "bg"] as const;
type SupportedLocale = (typeof SUPPORTED)[number];

// Drapeau SVG (flag-icons) — code pays ISO 3166-1 alpha-2 (en → gb, ar → sa).
// Emoji drapeaux non rendus sous Windows → on utilise les SVG comme le switcher.
const LOCALE_LABELS: Record<SupportedLocale, { name: string; iso: string }> = {
  nl: { name: "Nederlands", iso: "nl" },
  en: { name: "English", iso: "gb" },
  de: { name: "Deutsch", iso: "de" },
  ar: { name: "العربية", iso: "sa" },
  tr: { name: "Türkçe", iso: "tr" },
  ro: { name: "Română", iso: "ro" },
  bg: { name: "Български", iso: "bg" },
};

function Flag({ iso, className = "" }: { iso: string; className?: string }) {
  return (
    <span
      className={`fi fi-${iso} rounded-sm shadow-sm ${className}`}
      style={{ width: "1.25em", height: "0.9375em", display: "inline-block" }}
    />
  );
}

export default async function LocaleI18nPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) redirect("/login");

  const { locale } = await params;
  if (!SUPPORTED.includes(locale as SupportedLocale)) redirect("/admin/i18n/nl");

  const meta = LOCALE_LABELS[locale as SupportedLocale];

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <Flag iso={meta.iso} className="!h-6 !w-8" />
            <h1 className="text-3xl font-bold tracking-tight">
              Traductions {meta.name}
            </h1>
          </div>
          <p className="mt-1 text-muted-foreground">
            Relisez et corrigez les traductions — source <strong>FR</strong>{" "}
            à gauche, traduction <strong>{locale.toUpperCase()}</strong> à droite.
            Statuts : <strong>IA</strong> (1er jet) → <strong>Relu</strong> → <strong>Publié</strong>.
          </p>
        </div>

        {/* Sélecteur de langue */}
        <div className="flex flex-wrap gap-1.5">
          {SUPPORTED.map((loc) => (
            <a
              key={loc}
              href={`/admin/i18n/${loc}`}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                loc === locale
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Flag iso={LOCALE_LABELS[loc].iso} />
              {loc.toUpperCase()}
            </a>
          ))}
        </div>
      </div>

      <LocaleTranslationsManager locale={locale} />
    </div>
  );
}
