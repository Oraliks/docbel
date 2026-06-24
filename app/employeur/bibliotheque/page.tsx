import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LegalDisclaimerBox } from "@/components/docbel/employeur/legal-disclaimer-box";
import { TiltCard } from "@/components/docbel/employeur/ui/tilt-card";
import { getEmployerPageUser } from "@/lib/employeur/page-auth";
import { getLocalizedArticles } from "@/lib/employeur/library/articles";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.pro");
  return {
    title: t("libMetaTitle"),
    description: t("libMetaDesc"),
  };
}

export const dynamic = "force-dynamic";

export default async function BibliothequePage() {
  const t = await getTranslations("public.pro");
  const user = await getEmployerPageUser();
  if (!user) redirect("/p/employeur");

  const articles = await getLocalizedArticles();

  return (
    <div className="w-full space-y-5 p-4 sm:p-6 lg:px-8 duration-500 animate-in fade-in">
      <Button variant="ghost" size="sm" render={<Link href="/employeur" />}>
        <ArrowLeft /> {t("backToDashboard")}
      </Button>

      <div className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <BookOpen className="size-6 text-primary" aria-hidden />
          {t("libTitle")}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("libIntro")}</p>
      </div>

      <LegalDisclaimerBox context="general" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {articles.map((article, i) => (
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
                      {t("libRead")}{" "}
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
