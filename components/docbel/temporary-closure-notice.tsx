"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { TemporaryClosureKind } from "@/lib/public-access";

export function TemporaryClosureNotice({ kind, compact = false }: { kind: TemporaryClosureKind; compact?: boolean }) {
  const t = useTranslations("public.temporaryClosure");
  return (
    <section aria-label={t("title")} className="flex w-full flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-card-foreground">
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      <p className="text-sm leading-relaxed">{t(kind)}</p>
      {!compact && <nav className="flex flex-wrap gap-4 text-sm" aria-label={t("links")}>
        <Link href="/outils" className="underline underline-offset-4">{t("tools")}</Link>
        <Link href="/reprendre" className="underline underline-offset-4">{t("consult")}</Link>
        <Link href="/login" className="underline underline-offset-4">{t("login")}</Link>
      </nav>}
    </section>
  );
}
