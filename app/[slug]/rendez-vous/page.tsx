import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const LEGACY_SLUGS: Record<string, string> = { cgslb: "synova" };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (LEGACY_SLUGS[slug]) redirect("/" + LEGACY_SLUGS[slug] + "/rendez-vous");
  const tenant = await prisma.bookingTenant.findFirst({ where: { slug }, select: { name: true } });
  const d = await getTranslations("public.design");
  return tenant ? { title: d("bookingClosedTitle") + " — " + tenant.name } : {};
}

export default async function TenantBookingPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cp?: string; lang?: string }>;
}) {
  const { slug } = await params;
  const { cp, lang } = await searchParams;
  if (LEGACY_SLUGS[slug]) {
    const qs = new URLSearchParams();
    if (cp) qs.set("cp", cp);
    if (lang) qs.set("lang", lang);
    redirect("/" + LEGACY_SLUGS[slug] + "/rendez-vous" + (qs.size ? "?" + qs.toString() : ""));
  }
  const tenant = await prisma.bookingTenant.findFirst({ where: { slug }, select: { name: true } });
  if (!tenant) notFound();
  const d = await getTranslations("public.design");
  const chrome = await getTranslations("public.chrome");
  return (
    <section className="flex w-full flex-col gap-6">
      <p className="text-base font-semibold text-muted-foreground">{tenant.name}</p>
      <h1 className="text-3xl font-semibold leading-tight">{d("bookingClosedTitle")}</h1>
      <p className="leading-relaxed text-muted-foreground">{d("bookingClosedBody")}</p>
      <aside className="glass-feedback rounded-2xl p-5 leading-relaxed" data-tone="info">{d("bookingExistingHelp")}</aside>
      <Link href="/outils" className="inline-flex min-h-12 w-fit items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground">{chrome("navTools")}</Link>
    </section>
  );
}
