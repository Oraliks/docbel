import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle, ShieldCheck } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { requirePartnerOrAdminAuth } from "@/lib/auth-check";
import { allowedVisibilities } from "@/lib/chomage-ia/context";
import {
  auditCorpus,
  type AuditRow,
  type IssueKind,
} from "@/lib/reglementation/quality";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Santé du corpus — Réglementation | DocBel",
};

const KIND_LABEL: Record<IssueKind, string> = {
  "empty-content": "Contenu vide",
  "short-content": "Contenu très court",
  "truncated-comment": "Commentaire tronqué",
  "placeholder-body": "Corps vide, non marqué abrogé",
  "version-artefact": "Champ « version » = n° d'article",
};

const KIND_ORDER: IssueKind[] = [
  "empty-content",
  "truncated-comment",
  "placeholder-body",
  "short-content",
  "version-artefact",
];

interface RawRow {
  meta: unknown;
  title: string;
  content: string | null;
  len: bigint | number | null;
}

/**
 * Tableau de bord « santé du corpus » — réservé admin. Dérive à la volée (aucune
 * écriture) les anomalies exploitables : contenus vides/tronqués, corps
 * placeholder, artefacts du champ version.
 */
export default async function CorpusQualitePage() {
  const auth = await requirePartnerOrAdminAuth();
  if (!auth.isAuthorized || auth.user.isAdmin !== true) notFound();

  const visibilities = allowedVisibilities("admin");
  const raw = await prisma.$queryRawUnsafe<RawRow[]>(
    `SELECT s."legalMeta" AS meta, s."title" AS title,
            left(s."content", 2000) AS content, length(s."content") AS len
     FROM "KnowledgeSource" s
     WHERE s."domain" = 'chomage' AND s."enabled" = true
       AND s."visibility" = ANY($1::text[])
       AND s."legalMeta" IS NOT NULL`,
    visibilities,
  );

  const rows: AuditRow[] = raw.map((r) => {
    const m = (r.meta ?? {}) as Record<string, unknown>;
    return {
      riolexId: String(m.riolexId ?? ""),
      loi: String(m.loi ?? ""),
      articleNumber: String(m.articleNumber ?? ""),
      title: r.title,
      content: r.content ?? "",
      contentLength: Number(r.len ?? 0),
      version: m.version != null ? String(m.version) : null,
      datePublication: m.datePublication != null ? String(m.datePublication) : null,
      abroge: m.abroge === true,
      isComment: m.isOnemCommentary === true,
    };
  });

  const audit = auditCorpus(rows);

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="w-full space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/partenaire/reglementation"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Réglementation
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">Santé du corpus</h1>
          <Badge variant="secondary">admin</Badge>
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="py-3">
              <p className="text-2xl font-bold tabular-nums">{audit.total}</p>
              <p className="text-sm text-muted-foreground">sources ({audit.comments} commentaires)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3">
              <p className="text-2xl font-bold tabular-nums">{audit.issues.length}</p>
              <p className="text-sm text-muted-foreground">anomalies détectées</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-2 py-3">
              {audit.issues.length === 0 ? (
                <ShieldCheck className="size-8 text-emerald-500" aria-hidden />
              ) : (
                <AlertTriangle className="size-8 text-amber-500" aria-hidden />
              )}
              <p className="text-sm text-muted-foreground">
                {audit.issues.length === 0
                  ? "Aucune anomalie détectée."
                  : "À vérifier / recompléter."}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Groupes d'anomalies */}
        {KIND_ORDER.filter((k) => audit.byKind[k] > 0).map((kind) => {
          const list = audit.issues.filter((i) => i.kind === kind);
          return (
            <Card key={kind}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  {KIND_LABEL[kind]}
                  <Badge variant="outline">{list.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {list.slice(0, 100).map((issue) => (
                  <div key={`${issue.riolexId}-${issue.kind}`} className="flex flex-wrap items-center gap-2 text-sm">
                    <Link
                      href={`/partenaire/reglementation/${encodeURIComponent(issue.riolexId)}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {issue.loi} — Art. {issue.articleNumber}
                    </Link>
                    <span className="text-muted-foreground">{issue.detail}</span>
                  </div>
                ))}
                {list.length > 100 && (
                  <p className="text-xs text-muted-foreground">+ {list.length - 100} autres</p>
                )}
              </CardContent>
            </Card>
          );
        })}

        <p className="text-xs text-muted-foreground">
          Note : la date d'« entrée en vigueur » stockée est constante par loi (date du texte de
          base) ; la vraie dernière EV est dérivée des crochets de modification sur chaque fiche.
        </p>
      </div>
    </div>
  );
}
