import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LegalDisclaimerBox } from "@/components/docbel/employeur/legal-disclaimer-box";
import { TiltCard } from "@/components/docbel/employeur/ui/tilt-card";
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
    <div className="w-full space-y-5 p-4 sm:p-6 lg:px-8 duration-500 animate-in fade-in">
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {ARTICLES.map((article, i) => (
          <div
            key={article.slug}
            className="duration-500 animate-in fade-in slide-in-from-bottom-4"
            style={{ animationDelay: `${i * 45}ms`, animationFillMode: "backwards" }}
          >
            <TiltCard max={5}>
              <Link
                href={`/employeur/bibliotheque/${article.slug}`}
                className="group block h-full no-underline"
              >
                <Card className="flex h-full flex-col border-border/60 bg-card/80 backdrop-blur transition-colors hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10">
                  <CardHeader>
                    <CardTitle className="text-base">{article.title}</CardTitle>
                    <CardDescription className="line-clamp-3">{article.summary}</CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <span className="flex items-center gap-1 text-sm font-medium text-primary">
                      Lire{" "}
                      <ArrowRight
                        className="size-4 transition-transform group-hover:translate-x-1"
                        aria-hidden
                      />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            </TiltCard>
          </div>
        ))}
      </div>
    </div>
  );
}
