// Le C1 de changement de situation partage un AcroForm dont l'aplatissement via
// pdf-lib laisse des références XRef orphelines. Certains lecteurs les
// tolèrent, d'autres refusent le PDF téléchargé. Conserver l'AcroForm évite
// cette corruption tout en gardant les valeurs et apparences remplies.
const UNFLATTENED_FORM_SLUGS = new Set([
  "c1-changement-situation",
]);

export function shouldFlattenGeneratedPdf(slug: string): boolean {
  return !UNFLATTENED_FORM_SLUGS.has(slug);
}
