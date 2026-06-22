import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { GlossairePage } from "@/components/docbel/glossaire-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.glossaire");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default function GlossaireRoute() {
  return <GlossairePage />;
}
