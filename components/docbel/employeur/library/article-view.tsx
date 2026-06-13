/**
 * Vue d'un article de la bibliothèque employeur (Module 4).
 *
 * Composant présentationnel, compatible server component (pas de "use client") :
 * il reçoit l'article et la map des sources (résolue côté page) et n'a aucune
 * interactivité propre. Informatif, jamais bloquant.
 */
import Link from "next/link";
import { ClipboardList, FileDown, BookOpen, ListChecks, FileText, AlertTriangle, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LegalDisclaimerBox } from "@/components/docbel/employeur/legal-disclaimer-box";
import { SourceBadge } from "@/components/docbel/employeur/badges";
import type { LibraryArticle } from "@/lib/employeur/library/articles";
import type { SourceInfo } from "@/lib/employeur/queries";

function BulletSection({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function ArticleView({
  article,
  sources,
}: {
  article: LibraryArticle;
  sources: Map<string, SourceInfo>;
}) {
  return (
    <article className="space-y-5">
      <header className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary">
          <BookOpen className="size-3.5" aria-hidden />
          Bibliothèque des démarches
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{article.title}</h1>
        <p className="text-sm text-muted-foreground">{article.summary}</p>
      </header>

      <BulletSection
        icon={<BookOpen className="size-4 text-primary" aria-hidden />}
        title="Ce que vous devez savoir"
        items={article.whatToKnow}
      />
      <BulletSection
        icon={<ListChecks className="size-4 text-primary" aria-hidden />}
        title="À faire"
        items={article.todo}
      />
      <BulletSection
        icon={<FileText className="size-4 text-primary" aria-hidden />}
        title="Documents nécessaires"
        items={article.documents}
      />
      <BulletSection
        icon={<AlertTriangle className="size-4 text-primary" aria-hidden />}
        title="Erreurs fréquentes"
        items={article.commonMistakes}
      />

      {article.sourceCodes.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 className="size-4 text-primary" aria-hidden />
              Sources officielles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {article.sourceCodes.map((code) => {
                const s = sources.get(code);
                return (
                  <SourceBadge
                    key={code}
                    code={code}
                    href={s?.url}
                    title={s ? `${s.title} — ${s.institution}` : code}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {article.checklistCta ? (
          <Button render={<Link href="/employeur/nouveau-dossier" />}>
            <ClipboardList /> Créer ma checklist
          </Button>
        ) : null}
        <Button
          variant="outline"
          render={
            <a
              href={`/api/employeur/bibliotheque/${article.slug}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          <FileDown /> Exporter PDF
        </Button>
      </div>

      <LegalDisclaimerBox context="checklist" />
    </article>
  );
}
