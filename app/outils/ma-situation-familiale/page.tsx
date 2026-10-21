import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { getActiveBaremeData } from "@/lib/baremes/getActiveBaremeData"
import { getC1BaremeThresholds } from "@/lib/baremes/c1-thresholds"

import { FamilySituationClient } from "./family-situation-client"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("public.familySituation")

  return { title: t("metaTitle"), description: t("metaDescription") }
}

/**
 * Parcours citoyen local : seules les réponses restent dans le navigateur.
 * La qualification théorique est déléguée au moteur Article 110 partagé.
 */
export default async function FamilySituationPage() {
  // Use the existing published, dated source. Returning `null` remains safe
  // when it is unavailable; a short arbitrary timeout must not discard a
  // valid ceiling and turn complete partner facts into an unexplained gap.
  const activeBareme = await getActiveBaremeData().catch(() => null)
  return <FamilySituationClient thresholds={getC1BaremeThresholds(activeBareme)} />
}
