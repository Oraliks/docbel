import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BookOpenIcon, ScrollTextIcon } from "lucide-react";
import { requirePartnerOrAdminAuth } from "@/lib/auth-check";
import { getDossier } from "@/lib/dossiers/registry";
import { interpolateTheoryBody, visibleTheorySections } from "@/lib/dossiers/theory";
import { visibleProcedures } from "@/lib/dossiers/procedures";
import { TheoryRenderer } from "@/components/admin/dossiers/theory-renderer";
import { ProcedureRenderer } from "@/components/admin/dossiers/procedure-renderer";

export const dynamic = "force-dynamic";

type Tab = "theorie" | "procedure";

function parseTab(value: string | string[] | undefined): Tab {
  return value === "procedure" ? "procedure" : "theorie";
}

/// Espace pédagogique d'un dossier. Deux onglets :
/// - Théorie     : réglementation, motifs, qui est concerné, conditions…
/// - Procédure   : étapes opérationnelles d'introduction par nature de DA
/// Lecture seule, audience admin + partenaires uniquement.
export default async function DossierTheoriePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string; nature?: string }>;
}) {
  const auth = await requirePartnerOrAdminAuth();
  if (!auth.isAuthorized) redirect("/login");

  const t = await getTranslations("admin.dossiers");
  const { slug } = await params;
  const sp = await searchParams;
  const def = getDossier(slug);
  if (!def) notFound();

  const audience = auth.user.role === "admin" ? "admin" : "partner";
  const tab = parseTab(sp.tab);

  const sections = visibleTheorySections(def, audience);
  const procedures = visibleProcedures(def, audience);

  const baseTabUrl = (t: Tab, extra?: Record<string, string>) => {
    const q = new URLSearchParams({ tab: t, ...(extra ?? {}) });
    return `?${q.toString()}`;
  };

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <BookOpenIcon className="size-3.5" />
          {tab === "procedure" ? t("tabProcedures") : t("tabTheory")} · {def.slug}
        </div>
        <h1 className="text-2xl font-semibold">{def.title}</h1>
        <p className="text-sm text-muted-foreground">{def.description}</p>
      </header>

      <div role="tablist" className="flex gap-1 border-b">
        <Link
          role="tab"
          aria-selected={tab === "theorie"}
          href={baseTabUrl("theorie")}
          className={
            tab === "theorie"
              ? "flex items-center gap-2 border-b-2 border-foreground px-4 py-2 text-sm font-medium"
              : "flex items-center gap-2 border-b-2 border-transparent px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          }
        >
          <BookOpenIcon className="size-4" />
          {t("tabTheory")}
          {sections.length > 0 && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
              {sections.length}
            </span>
          )}
        </Link>
        <Link
          role="tab"
          aria-selected={tab === "procedure"}
          href={baseTabUrl("procedure")}
          className={
            tab === "procedure"
              ? "flex items-center gap-2 border-b-2 border-foreground px-4 py-2 text-sm font-medium"
              : "flex items-center gap-2 border-b-2 border-transparent px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          }
        >
          <ScrollTextIcon className="size-4" />
          {t("tabProcedureIntro")}
          {procedures.length > 0 && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
              {procedures.length}
            </span>
          )}
        </Link>
      </div>

      {tab === "theorie" ? (
        sections.length === 0 ? (
          <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
            {t("theoryEmpty")}
          </div>
        ) : (
          <>
            <nav aria-label={t("toc")} className="rounded-lg border bg-card p-4 text-sm">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("toc")}
              </div>
              <ol className="flex flex-col gap-1">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="text-foreground hover:underline">
                      {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <article className="flex flex-col gap-8">
              {sections.map((s) => {
                const rendered = interpolateTheoryBody(s, def);
                return (
                  <section key={s.id} id={s.id} className="scroll-mt-6 flex flex-col gap-3">
                    <header className="flex items-baseline justify-between border-b pb-2">
                      <h2 className="text-lg font-semibold">{s.title}</h2>
                      {s.lastReviewedAt && (
                        <span className="text-[11px] text-muted-foreground">
                          {t("reviewedOn", { date: s.lastReviewedAt })}
                        </span>
                      )}
                    </header>
                    <TheoryRenderer markdown={rendered} />
                  </section>
                );
              })}
            </article>
          </>
        )
      ) : procedures.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
          {t("procedureEmpty")}
        </div>
      ) : (
        <ProcedureTabContent
          procedures={procedures}
          activeNature={sp.nature}
          baseTabUrl={baseTabUrl}
        />
      )}
    </div>
  );
}

/// Sous-vue de l'onglet "Procédure" : sélecteur de nature de DA en haut,
/// rendu de la procédure sélectionnée en dessous.
async function ProcedureTabContent({
  procedures,
  activeNature,
  baseTabUrl,
}: {
  procedures: ReturnType<typeof visibleProcedures>;
  activeNature: string | undefined;
  baseTabUrl: (t: Tab, extra?: Record<string, string>) => string;
}) {
  const t = await getTranslations("admin.dossiers");
  const selected =
    procedures.find((p) => p.natureDA === activeNature) ??
    procedures.find((p) => p.id === activeNature) ??
    procedures[0];

  return (
    <>
      <nav aria-label={t("procedureNatureSelect")} className="flex flex-wrap gap-1">
        {procedures.map((p) => {
          const isActive = selected?.id === p.id;
          return (
            <Link
              key={p.id}
              href={baseTabUrl("procedure", { nature: p.natureDA })}
              className={
                isActive
                  ? "inline-flex items-center gap-1.5 rounded-md border bg-foreground px-2.5 py-1.5 text-xs font-medium text-background"
                  : "inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              }
            >
              <code className="font-mono">{p.natureDA}</code>
              <span className="truncate max-w-[14rem]">{p.title.replace(/^Introduction\s+[A-Z]+\s+—\s+/, "")}</span>
            </Link>
          );
        })}
      </nav>
      {selected && <ProcedureRenderer procedure={selected} />}
    </>
  );
}
