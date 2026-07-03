import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Route } from "lucide-react";

import { requirePartnerOrAdminAuth } from "@/lib/auth-check";
import { getParcours } from "@/lib/reglementation/parcours";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Parcours de lecture — Réglementation | DocBel",
};

/**
 * Parcours de lecture thématiques : pour chaque thème, les articles concernés
 * dans l'ordre. Fils de lecture dérivés des données (pas de curation manuelle).
 */
export default async function ParcoursPage() {
  const auth = await requirePartnerOrAdminAuth();
  if (!auth.isAuthorized) notFound();

  const parcours = await getParcours();

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="w-full space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/partenaire/reglementation"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Réglementation
          </Link>
          <h1 className="inline-flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Route className="size-5" aria-hidden />
            Parcours de lecture
          </h1>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Chaque parcours regroupe, dans l’ordre, les articles qui touchent à un
          thème du chômage. Un fil de lecture pour balayer un sujet sans deviner
          les numéros — les rattachements sont dérivés du texte, à titre indicatif.
        </p>

        <div className="grid gap-4 lg:grid-cols-2">
          {parcours.map((p) => (
            <Card key={p.key}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  #{p.label}
                  <Badge variant="outline">{p.steps.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-1">
                  {p.steps.slice(0, 20).map((s, i) => (
                    <li key={s.riolexId} className="flex items-baseline gap-2 text-sm">
                      <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                        {i + 1}.
                      </span>
                      <Link
                        href={`/partenaire/reglementation/${encodeURIComponent(s.riolexId)}`}
                        className="min-w-0 underline-offset-2 hover:underline"
                      >
                        <span className="font-medium">Art. {s.articleNumber}</span>
                        <span className="text-muted-foreground"> — {s.loi}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
                {p.steps.length > 20 && (
                  <Link
                    href={`/partenaire/reglementation?theme=${p.key}`}
                    className="mt-2 inline-block text-xs text-primary hover:underline"
                  >
                    Voir les {p.steps.length} articles →
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
