import { notFound, redirect } from "next/navigation";
import { BookOpenIcon } from "lucide-react";
import { requirePartnerOrAdminAuth } from "@/lib/auth-check";
import { getDossier } from "@/lib/dossiers/registry";
import { interpolateTheoryBody, visibleTheorySections } from "@/lib/dossiers/theory";
import { TheoryRenderer } from "@/components/admin/dossiers/theory-renderer";

export const dynamic = "force-dynamic";

/// Espace théorique d'un dossier. Lecture seule, ouverte aux partenaires
/// (rôle partner) et aux admins. Contenu rédigé en interne, paraphrasé —
/// jamais de citation longue d'une source non publique.
export default async function DossierTheoriePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const auth = await requirePartnerOrAdminAuth();
  if (!auth.isAuthorized) redirect("/login");

  const { slug } = await params;
  const def = getDossier(slug);
  if (!def) notFound();

  // Audience = "admin" si rôle admin, sinon "partner".
  const audience = auth.user.role === "admin" ? "admin" : "partner";
  const sections = visibleTheorySections(def, audience);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 lg:p-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <BookOpenIcon className="size-3.5" />
          Théorie · {def.slug}
        </div>
        <h1 className="text-2xl font-semibold">{def.title}</h1>
        <p className="text-sm text-muted-foreground">{def.description}</p>
      </header>

      {sections.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
          Aucune section théorique disponible pour ce dossier.
        </div>
      ) : (
        <nav aria-label="Sommaire" className="rounded-lg border bg-card p-4 text-sm">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Sommaire
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
      )}

      <article className="flex flex-col gap-8">
        {sections.map((s) => {
          const rendered = interpolateTheoryBody(s, def);
          return (
            <section key={s.id} id={s.id} className="scroll-mt-6 flex flex-col gap-3">
              <header className="flex items-baseline justify-between border-b pb-2">
                <h2 className="text-lg font-semibold">{s.title}</h2>
                {s.lastReviewedAt && (
                  <span className="text-[11px] text-muted-foreground">
                    Revu le {s.lastReviewedAt}
                  </span>
                )}
              </header>
              <TheoryRenderer markdown={rendered} />
            </section>
          );
        })}
      </article>
    </div>
  );
}
