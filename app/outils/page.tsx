import { getPublicCatalog } from "@/lib/outils-catalog";
import { OutilsCatalogClient } from "./outils-catalog-client";

export const dynamic = "force-dynamic";

/**
 * Catalogue public /outils — server-rendered.
 *
 * La liste vient de la DB (Tool.active=true) + entrées statiques avec href
 * absolu (cf. lib/outils-catalog.ts). Toute désactivation/suppression côté
 * admin (/admin/chomage/outils) se reflète instantanément ici.
 */
export default async function OutilsIndexPage() {
  const tools = await getPublicCatalog();
  return <OutilsCatalogClient tools={tools} />;
}
