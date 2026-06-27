import { redirect } from "next/navigation";
import { requireAdminAuth } from "@/lib/auth-check";
import { LocaleTranslationsManager } from "./locale-translations-manager";

export const dynamic = "force-dynamic";

const SUPPORTED = ["nl", "en", "de", "ar", "tr", "ro", "bg"] as const;
type SupportedLocale = (typeof SUPPORTED)[number];

const LOCALE_LABELS: Record<SupportedLocale, { name: string; flag: string }> = {
  nl: { name: "Nederlands", flag: "🇳🇱" },
  en: { name: "English", flag: "🇬🇧" },
  de: { name: "Deutsch", flag: "🇩🇪" },
  ar: { name: "العربية", flag: "🇸🇦" },
  tr: { name: "Türkçe", flag: "🇹🇷" },
  ro: { name: "Română", flag: "🇷🇴" },
  bg: { name: "Български", flag: "🇧🇬" },
};

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
          <div className="flex items-center gap-2">
            <span className="text-2xl">{meta.flag}</span>
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
              className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                loc === locale
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-accent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{LOCALE_LABELS[loc].flag}</span>
              {loc.toUpperCase()}
            </a>
          ))}
        </div>
      </div>

      <LocaleTranslationsManager locale={locale} />
    </div>
  );
}
