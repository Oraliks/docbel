"use client";

import { useRouter, useParams } from "next/navigation";
import { ToolPage } from "@/components/docbel/tool-page";
import { getToolBySlug } from "@/lib/docbel-data";
import { DARK_COLORS, LIGHT_COLORS } from "@/lib/colors";
import { useAppState } from "@/lib/app-state-context";

export default function ToolRoute() {
  const router = useRouter();
  const params = useParams();
  const { dark } = useAppState();

  const colors = dark ? DARK_COLORS : LIGHT_COLORS;
  const accent = "#C8102E";

  const tool = getToolBySlug(params.slug as string);

  if (!tool) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <h1>Outil non trouvé</h1>
        <button onClick={() => router.push("/")}>Retour à l'accueil</button>
      </div>
    );
  }

  return (
    <div style={{ padding: "32px 36px 40px" }}>
      <ToolPage tool={tool} colors={colors} accent={accent} onBack={() => router.back()} lang="FR" />
    </div>
  );
}
