"use client";

/**
 * Feuille de route de fin de parcours — l'écran de sortie du dossier.
 *
 * Affichée par BundleRunner quand tous les documents OBLIGATOIRES sont
 * complétés : elle transforme « une liste de téléchargements » en plan
 * d'action concret (imprimer/signer → joindre les pièces tierces → envoyer
 * à l'organisme de paiement → garder le code de reprise).
 *
 * Informatif, jamais bloquant : aucune décision, le disclaimer rappelle que
 * seuls l'organisme de paiement et l'ONEM font foi. Les étapes sont
 * numérotées dynamiquement (la section « pièces tierces » n'apparaît que si
 * le dossier en comporte).
 */

import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  ExternalLink,
  Landmark,
  ListChecks,
  Paperclip,
  Printer,
  ShieldAlert,
  Signature,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Document rempli par l'utilisateur (PDF généré), avec lien de relecture. */
export interface RoadmapDocument {
  slug: string;
  title: string;
  href: string;
}

/** Pièce à charge d'un tiers, reprise de l'aide-mémoire du parcours. */
export interface RoadmapExternalDocument {
  slug: string;
  title: string;
  issuer: string;
  required: boolean;
}

interface BundleRoadmapProps {
  documents: RoadmapDocument[];
  externalDocuments: RoadmapExternalDocument[];
  resumeCode: string | null;
}

interface RoadmapStep {
  key: string;
  icon: React.ReactNode;
  title: string;
  body?: string;
  content?: React.ReactNode;
}

export function BundleRoadmap({
  documents,
  externalDocuments,
  resumeCode,
}: BundleRoadmapProps) {
  const t = useTranslations("public.dossier");

  const requiredExternal = externalDocuments.filter((d) => d.required);

  const steps: RoadmapStep[] = [];

  if (documents.length > 0) {
    steps.push({
      key: "docs",
      icon: <Signature className="w-4 h-4" />,
      title: t("roadmapStepDocs"),
      body: t("roadmapStepDocsHint"),
      content: (
        <ul className="space-y-1.5 mt-2">
          {documents.map((d) => (
            <li key={d.slug} className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{d.title}</span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                render={<Link href={d.href} />}
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                {t("roadmapReview")}
              </Button>
            </li>
          ))}
        </ul>
      ),
    });
  }

  if (requiredExternal.length > 0) {
    steps.push({
      key: "attach",
      icon: <Paperclip className="w-4 h-4" />,
      title: t("roadmapStepAttach"),
      body: t("roadmapStepAttachHint"),
      content: (
        <ul className="space-y-1.5 mt-2">
          {requiredExternal.map((d) => (
            <li key={d.slug} className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{d.title}</span>
              <Badge variant="outline" className="text-xs">
                {t("roadmapAttachFrom", { issuer: d.issuer })}
              </Badge>
            </li>
          ))}
        </ul>
      ),
    });
  }

  steps.push({
    key: "send",
    icon: <Landmark className="w-4 h-4" />,
    title: t("roadmapStepSend"),
    body: t("roadmapStepSendBody"),
  });

  if (resumeCode) {
    steps.push({
      key: "keep",
      icon: <ListChecks className="w-4 h-4" />,
      title: t("roadmapStepKeep"),
      body: t("roadmapStepKeepBody"),
      content: (
        <p className="mt-2 font-mono text-sm font-semibold tracking-wider">
          {resumeCode}
        </p>
      ),
    });
  }

  return (
    <Card className="border-emerald-500/30 bg-emerald-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-green-600" />
              {t("roadmapTitle")}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {t("roadmapIntro")}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="print:hidden"
            onClick={() => window.print()}
          >
            <Printer className="w-4 h-4 mr-1" />
            {t("roadmapPrint")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {steps.map((step, idx) => (
          <div key={step.key} className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-emerald-500/15 text-green-700 dark:text-green-400 flex items-center justify-center text-sm font-semibold flex-shrink-0">
              {idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium flex items-center gap-2">
                {step.icon}
                {step.title}
              </p>
              {step.body && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {step.body}
                </p>
              )}
              {step.content}
            </div>
          </div>
        ))}

        <p className="text-xs text-muted-foreground flex items-start gap-2 border-t pt-3">
          <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {t("roadmapDisclaimer")}
        </p>
      </CardContent>
    </Card>
  );
}
