"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Building2, Eye, MapPinned } from "lucide-react";
import { BureausManager } from "./bureaux-manager";
import { ServiceAssignmentsManager } from "./bureaux/service-assignments-manager";
import { OnemAssignmentsManager } from "./bureaux/onem-assignments-manager";
import { HealthDashboard } from "./bureaux/health-dashboard";
import { PreviewFinder } from "./bureaux/preview-finder";

type Tab = "sante" | "preview" | "annuaire" | "services" | "onem";

// Onglet "commissions" retiré : la feature commission paritaire (syndicats
// sectoriels) n'était pas surfacée côté front (pas de sélecteur). Code +
// route + composant supprimés ; modèles Prisma conservés au cas où on
// veuille ré-ouvrir cette feature (les tables BureauCommission /
// CommissionParitaire restent en DB, juste plus utilisées).
const TABS: Array<{ value: Tab; label: string; icon: React.ComponentType<{ className?: string }>; help: string }> = [
  {
    value: "sante",
    label: "Santé",
    icon: Activity,
    help: "Vue d'ensemble : couverture territoriale, trous data, stubs à enrichir",
  },
  {
    value: "preview",
    label: "Aperçu user",
    icon: Eye,
    help: "Teste un CP — vois exactement ce qu'un utilisateur public verrait",
  },
  {
    value: "annuaire",
    label: "Annuaire",
    icon: Building2,
    help: "Tous les bureaux : créer, modifier, vérifier, exporter",
  },
  {
    value: "services",
    label: "Compétences territoriales",
    icon: MapPinned,
    help: "Quel bureau dessert quelle commune (ONEM, CAPAC, FGTB, CSC, mutuelles…)",
  },
  {
    value: "onem",
    label: "Compétences ONEM",
    icon: MapPinned,
    help: "Vue dédiée ONEM avec sélection multi-communes",
  },
];

export function BureauxAdminWorkspace() {
  const [tab, setTab] = useState<Tab>("sante");

  // Sync depuis l'URL hash (initial + clic sidebar même page)
  useEffect(() => {
    const apply = () => {
      const h = window.location.hash.replace(/^#/, "");
      if (TABS.some((t) => t.value === h)) {
        setTab(h as Tab);
      }
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  // Persist tab in URL hash
  useEffect(() => {
    if (window.location.hash !== `#${tab}`) {
      window.history.replaceState(null, "", `#${tab}`);
    }
  }, [tab]);

  const currentTab = TABS.find((t) => t.value === tab);

  return (
    <Tabs value={tab} onValueChange={(v) => setTab((v ?? "sante") as Tab)}>
      <TabsList className="flex w-full overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5 flex-1 min-w-fit">
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.label.split(" ")[0]}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>

      {currentTab && (
        <p className="text-xs text-muted-foreground mt-2 mb-3 px-1">{currentTab.help}</p>
      )}

      <TabsContent value="sante" className="mt-0">
        <HealthDashboard />
      </TabsContent>

      <TabsContent value="preview" className="mt-0">
        <PreviewFinder />
      </TabsContent>

      <TabsContent value="annuaire" className="mt-0">
        <BureausManager />
      </TabsContent>

      <TabsContent value="services" className="mt-0">
        <ServiceAssignmentsManager />
      </TabsContent>

      <TabsContent value="onem" className="mt-0">
        <OnemAssignmentsManager />
      </TabsContent>
    </Tabs>
  );
}
