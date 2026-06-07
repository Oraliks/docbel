import { redirect } from "next/navigation";

/**
 * Le Calcul AGR vit dans le shell partenaire (`/partenaire/outils/calcul-agr`,
 * auth FGTB+admin), mais le catalogue d'outils route par slug vers
 * `/outils/{slug}`. On redirige donc le slug standard vers la page réelle.
 */
export default function CalculAgrCatalogRedirect() {
  redirect("/partenaire/outils/calcul-agr");
}
