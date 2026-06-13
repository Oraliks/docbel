import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LegalDisclaimerBox } from "@/components/docbel/employeur/legal-disclaimer-box";
import { getEmployerPageUser } from "@/lib/employeur/page-auth";
import { ARTICLES } from "@/lib/employeur/library/articles";

export const metadata: Metadata = {
  title: "Bibliothèque des démarches | Espace Employeur",
  description:
    "Articles pédagogiques sur les démarches employeur en Belgique : Dimona, DmfA, contrats, étudiant, flexi-job, chômage temporaire et plus.",
};

export const dynamic = "force-dynamic";

export default async function BibliothequePage() {
  const user = await getEmployerPageUser();
  if (!user) redirect("/p/employeur");

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6">
      <Button variant="ghost" size="sm" render={<Link href="/employeur" />}>
        <ArrowLeft /> Tableau de bord
      </Button>

      <div className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <BookOpen className="size-6 text-primary" aria-hidden />
          Bibliothèque des démarches
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Des fiches claires et vulgarisées sur les principales démarches d&apos;un employeur en
          Belgique. Chaque fiche renvoie aux sources officielles pour la règle exacte applicable à
          votre situation.
        </p>
      </div>

      <LegalDisclaimerBox context="general" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ARTICLES.map((article) => (
          <Link
            key={article.slug}
            href={`/employeur/bibliotheque/${article.slug}`}
            className="block no-underline"
          >
            <Card className="flex h-full flex-col transition-colors hover:border-primary/40">
              <CardHeader>
                <CardTitle className="text-base">{article.title}</CardTitle>
                <CardDescription className="line-clamp-3">{article.summary}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <span className="flex items-center gap-1 text-sm font-medium text-primary">
                  Lire <ArrowRight className="size-4" aria-hidden />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
