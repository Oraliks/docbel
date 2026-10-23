import Link from "next/link";
import { AccessibilityToolbar } from "@/components/docbel/accessibility-toolbar";
import { getTranslations } from "next-intl/server";
import { BookOpen, Type, MessageCircle, LayoutGrid, ArrowRight } from "lucide-react";

export default async function HelpPage() {
  const t = await getTranslations("public.design");
  const sections = [
    { title: t("helpGlossary"), body: t("helpGlossaryBody"), href: "/glossaire", Icon: BookOpen },
    { title: t("helpDisplay"), body: t("helpDisplayBody"), href: "#affichage", Icon: Type },
    { title: t("helpTools"), body: t("helpToolsBody"), href: "/outils", Icon: LayoutGrid },
    { title: t("helpContact"), body: t("helpContactBody"), href: "/contact", Icon: MessageCircle },
  ];
  return <section className="flex w-full flex-col gap-8">
    <header><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("helpTitle")}</h1><p className="mt-4 text-base leading-relaxed text-muted-foreground">{t("helpDescription")}</p></header>
    <div className="grid gap-4 sm:grid-cols-2">{sections.map(({title,body,href,Icon}) => <Link href={href} key={href} className="glass-surface glass-interactive flex flex-col gap-4 p-6">
      <Icon className="size-7 text-primary" aria-hidden /><h2 className="text-xl font-semibold">{title}</h2><p className="flex-1 leading-relaxed text-muted-foreground">{body}</p><ArrowRight className="size-5 text-primary rtl:rotate-180" aria-hidden />
    </Link>)}</div><section id="affichage" className="glass-surface flex flex-col gap-4 p-6"><h2 className="text-xl font-semibold">{t("helpDisplay")}</h2><AccessibilityToolbar /></section><p className="rounded-2xl border p-5 text-sm leading-relaxed text-muted-foreground">{t("helpScope")}</p>
  </section>;
}
