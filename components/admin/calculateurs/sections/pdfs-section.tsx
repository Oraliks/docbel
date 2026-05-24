import {
  AssetsManager,
  type CalculatorAsset,
} from "@/components/admin/calculateurs/assets-manager";

interface MethodologyPdfsSectionProps {
  slug: string;
  assets: CalculatorAsset[];
}

/**
 * Wrapper de `<AssetsManager />` pour l'onglet "PDFs attachés".
 *
 * Pas de logique supplémentaire ici — on délègue tout au manager
 * (création / édition / suppression de sources + assets PDFs).
 */
export function MethodologyPdfsSection({
  slug,
  assets,
}: MethodologyPdfsSectionProps) {
  return <AssetsManager slug={slug} initialAssets={assets} />;
}
