import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Wrench, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

interface Props {
  toolName: string;
}

/**
 * Vue présentée quand un outil existe en DB mais a été désactivé par l'admin
 * (active=false). Préférable au 404 brut : l'utilisateur comprend que c'est
 * temporaire et qu'on a un plan.
 */
export async function DisabledToolView({ toolName }: Props) {
  const t = await getTranslations("public.outils");

  return (
    <section className="flex w-full flex-col gap-6">
      <Empty className="glass-feedback py-16" data-tone="attention">
        <EmptyHeader>
          <EmptyMedia
            variant="icon"
            className="border border-attention-border bg-attention-subtle text-attention-subtle-foreground"
          >
            <Wrench />
          </EmptyMedia>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
            {t("disabledEyebrow")}
          </p>
          <EmptyTitle className="glass-display text-[30px] leading-[1.1] sm:text-[38px]">
            {toolName}{" "}
            <em className="text-[color:var(--glass-ink-soft)]">
              {t("disabledTitle")}
            </em>
          </EmptyTitle>
          <EmptyDescription className="max-w-xl text-[color:var(--glass-ink-soft)]">
            {t.rich("disabledBody", {
              strong: (c) => (
                <strong className="text-[color:var(--glass-ink)]">{c}</strong>
              ),
            })}
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent className="sm:flex-row sm:justify-center">
          <Button
            render={<Link href="/mon-dossier" />}
          >
            {t("needHelp")}
          </Button>
          <Button
            variant="outline"
            render={<Link href="/outils" />}
          >
            <ArrowLeft data-icon="inline-start" />
            {t("backToCatalog")}
          </Button>
        </EmptyContent>
      </Empty>
    </section>
  );
}
