import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { InscriptionSplit } from "@/components/docbel/inscription-split";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.auth");
  return {
    title: t("signupMetaTitle"),
    description: t("signupMetaDescription"),
  };
}

export default async function InscriptionRoute() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  if (session?.user) redirect("/");

  return <InscriptionSplit />;
}
