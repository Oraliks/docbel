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
  // The public flow only receives the existing, read-only thresholds. The shared
  // Article 110 evaluator remains the sole place where categories are calculated.
  // A missing local database must never keep this public route in its loading state.
  const activeBareme = await Promise.race([
    getActiveBaremeData().catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 1_500)),
  ])
  return <FamilySituationClient thresholds={getC1BaremeThresholds(activeBareme)} />
}
