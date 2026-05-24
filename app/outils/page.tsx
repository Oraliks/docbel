import { filterByAudience, getPublicCatalog } from "@/lib/outils-catalog";
import { OutilsCatalogClient } from "./outils-catalog-client";

export const dynamic = "force-dynamic";

/**
 * Catalogue public /outils — server-rendered.
 *
 * La liste vient de la DB (Tool.active=true) + entrées statiques avec href
 * absolu (cf. lib/outils-catalog.ts). Toute désactivation/suppression côté
 * admin (/admin/chomage/outils) se reflète instantanément ici.
 *
 * Audience : on est dans /outils (sans préfixe d'espace), donc on filtre
 * pour l'audience "citoyen" → seuls les outils marqués comme accessibles
 * aux citoyens (audience = "citoyen") apparaissent. Les outils restreints
 * employeur/partenaire restent invisibles ici.
 */
export default async function OutilsIndexPage() {
  const all = await getPublicCatalog();
  const tools = filterByAudience(all, "citoyen");
  return <OutilsCatalogClient tools={tools} />;
}
