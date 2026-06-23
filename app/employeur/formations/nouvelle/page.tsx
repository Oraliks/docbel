import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OrgFormationsNewPage } from "@/components/formations/org/server-pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.pro");
  return { title: t("formationsNewMetaTitle") };
}
export const dynamic = "force-dynamic";

export default function Page() {
  return <OrgFormationsNewPage segment="employeur" />;
}
