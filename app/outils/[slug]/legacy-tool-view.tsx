"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeftIcon, WrenchIcon } from "lucide-react";
import { ToolPage } from "@/components/docbel/tool-page";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { Tool } from "@/lib/docbel-data";
import { glyphForTool } from "@/lib/tool-glyphs";

interface LegacyToolViewProps {
  tool: Tool | null;
}

export function LegacyToolView({ tool }: LegacyToolViewProps) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("public.outils");

  if (!tool) {
    return (
      <section className="flex w-full flex-col gap-6">
        <Empty className="glass-surface py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <WrenchIcon />
            </EmptyMedia>
            <EmptyTitle className="glass-display text-2xl">
              {t("notFoundTitle")}
            </EmptyTitle>
            <EmptyDescription>{t("notFoundBody")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" onClick={() => router.push("/outils")}>
              <ArrowLeftIcon data-icon="inline-start" />
              {t("backToCatalog")}
            </Button>
          </EmptyContent>
        </Empty>
      </section>
    );
  }

  const { hue } = glyphForTool(tool);

  return (
    <ToolPage
      tool={tool}
      accent={hue}
      onBack={() => router.push("/outils")}
      lang={locale}
    />
  );
}
