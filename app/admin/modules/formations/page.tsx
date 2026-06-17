import { getFormationsModule, getFormationsFlags } from "@/lib/formations/module";
import { ModuleSettingsClient } from "./module-settings-client";

export const dynamic = "force-dynamic";

/**
 * Réglages du module Formations (activation globale, espaces, maintenance, mode
 * de lancement) + feature flags. Le layout /admin impose déjà l'auth admin, donc
 * pas de guard supplémentaire ici : on charge l'état serveur et on le passe au
 * composant client. Les mutations passent par /api/admin/formations/*.
 */
export default async function FormationsModuleSettingsPage() {
  const [module, flags] = await Promise.all([
    getFormationsModule(),
    getFormationsFlags(),
  ]);

  return <ModuleSettingsClient initialModule={module} initialFlags={flags} />;
}
