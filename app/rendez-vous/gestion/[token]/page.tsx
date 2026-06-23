import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ManageClient } from "../../manage-client";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.dossier");
  return {
    title: t("manageMetaTitle"),
  };
}

export default async function ManagePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = await getTranslations("public.dossier");
  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
          {t("manageEyebrow")}
        </p>
        <h1 className="glass-display text-[32px] font-semibold leading-[1.05] sm:text-[40px]">
          {t("manageTitle")}
        </h1>
      </div>
      <ManageClient token={token} />
    </section>
  );
}
