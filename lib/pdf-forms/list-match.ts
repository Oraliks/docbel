import { isFieldVisible } from "./validation";
import { loc, type FormPayload, type Locale, type Localized } from "./types";

/// Forme minimale acceptée — couvre PdfFormField (serveur) ET PublicField
/// (client) sans cast.
interface ListMatchFieldShape {
  id: string;
  requireListMatch?: { escapeFieldId: string; message?: Localized };
  visibleIf?: Parameters<typeof isFieldVisible>[0];
}

const DEFAULT_MESSAGE: Localized = {
  fr: "Choisis ta rue dans la liste proposée, ou coche « ma rue n'est pas dans la liste ».",
  nl: "Kies je straat uit de lijst, of vink « mijn straat staat niet in de lijst » aan.",
  de: "Wähle deine Straße aus der Liste oder kreuze « meine Straße ist nicht in der Liste » an.",
};

/// Vérifie les champs `requireListMatch` : un champ rempli, VISIBLE, non
/// vérifié (l'utilisateur n'a pas choisi dans la liste) et sans case
/// d'échappement cochée → erreur. Pur (aucune dépendance réseau/React) :
/// l'ensemble `verified` des ids déjà validés vient du runner, qui l'alimente
/// quand une suggestion est sélectionnée. Un champ vide est ignoré (le requis
/// est géré par Zod par ailleurs).
export function findListMatchErrors(
  fields: ListMatchFieldShape[],
  values: FormPayload,
  verified: ReadonlySet<string>,
  locale: Locale
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    if (!f.requireListMatch) continue;
    if (f.visibleIf && !isFieldVisible(f.visibleIf, values)) continue;
    const v = values[f.id];
    const filled = typeof v === "string" && v.trim() !== "";
    if (!filled) continue;
    if (values[f.requireListMatch.escapeFieldId] === true) continue;
    if (verified.has(f.id)) continue;
    errors[f.id] = loc(f.requireListMatch.message ?? DEFAULT_MESSAGE, locale);
  }
  return errors;
}
