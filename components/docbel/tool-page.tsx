"use client";

import { useEffect, useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tool } from "@/lib/docbel-data";
import { IconDisplay } from "@/components/admin/documents/icon-picker";
import {
  CalcAGR,
  CalcCP,
  CalcPreavis,
  FormFlow,
  InfoPanel,
  LinkPanel,
  Locator,
  Tutorial,
} from "./tool-views";

interface ToolPageProps {
  tool: Tool;
  accent: string;
  onBack: () => void;
  lang: string;
}

interface PreavisMetadata {
  source: string;
  lastUpdated: string;
}

export function ToolPage({ tool, accent, onBack, lang }: ToolPageProps) {
  const [preavisMetadata, setPreavisMetadata] = useState<PreavisMetadata | null>(null);
  const type = tool.type || "form";

  useEffect(() => {
    if (type !== "calc_preavis") return;

    fetch("/api/admin/preavis")
      .then((response) => response.json())
      .then((data) => {
        setPreavisMetadata({
          source: data.metadata?.source || "SPF Emploi",
          lastUpdated: data.metadata?.lastUpdated || "",
        });
      })
      .catch(() => {
        setPreavisMetadata({
          source: "SPF Emploi",
          lastUpdated: "",
        });
      });
  }, [type]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeftIcon data-icon="inline-start" />
          Retour
        </Button>
        <Badge variant="secondary">{tool.cat}</Badge>
        {tool.popular && <Badge>Populaire</Badge>}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IconDisplay value={tool.icon} className="w-6 h-6" />
            </span>
            <div className="flex flex-col gap-1">
              <CardTitle className="text-2xl">{tool.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{tool.desc}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {type === "calc_preavis" && <CalcPreavis accent={accent} />}
          {type === "calc_agr" && <CalcAGR accent={accent} />}
          {type === "calc_cp" && <CalcCP accent={accent} />}
          {type === "locator" && <Locator tool={tool} accent={accent} />}
          {type === "tutorial" && <Tutorial tool={tool} accent={accent} />}
          {type === "info" && <InfoPanel tool={tool} accent={accent} />}
          {type === "link" && <LinkPanel tool={tool} accent={accent} />}
          {(type === "form" || type === "doc" || type === "calc") && (
            <FormFlow tool={tool} accent={accent} lang={lang} />
          )}
        </CardContent>

        {type === "calc_preavis" && preavisMetadata && (
          <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t text-sm text-muted-foreground">
            <span>
              Source: <span className="font-medium text-foreground">{preavisMetadata.source}</span>
            </span>
            {preavisMetadata.lastUpdated && (
              <span>
                Mise a jour:{" "}
                <span className="font-medium text-foreground">{preavisMetadata.lastUpdated}</span>
              </span>
            )}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
