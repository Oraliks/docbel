import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const d = await getTranslations("public.design");
  return { title: d("bookingClosedTitle"), description: d("bookingClosedBody") };
}

export default async function RdvDiscoveryPage() {
  const d = await getTranslations("public.design");
  const t = await getTranslations("public.dossier");
  const chrome = await getTranslations("public.chrome");
  return (
    <section className="flex w-full flex-col gap-6">
      <h1 className="text-3xl font-semibold leading-tight">{d("bookingClosedTitle")}</h1>
      <p className="leading-relaxed text-muted-foreground">{d("bookingClosedBody")}</p>
      <aside className="glass-feedback rounded-2xl p-5 leading-relaxed" data-tone="info">{d("bookingExistingHelp")}</aside>
      <div className="flex flex-wrap gap-3">
        <Link href="/rendez-vous/guichets" className="inline-flex min-h-12 items-center rounded-xl border px-5 font-semibold">{t("rdvBrowseAll")}</Link>
        <Link href="/outils" className="inline-flex min-h-12 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground">{chrome("navTools")}</Link>
      </div>
    </section>
  );
}
