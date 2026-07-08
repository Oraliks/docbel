// Macro : date en-tête de page (ex. « Date de DA » du C1 page 2) avec
// résolution en cascade sur plusieurs sources et formatage FR obligatoire.
//
// Pattern : la première source non vide gagne. Utile quand un widget PDF
// unique doit refléter la « date pertinente » du dossier — qui varie selon
// le contexte (date de modification si c'est un changement, sinon date de
// demande initiale).

import type { MappingRule } from "../types";
import type { FormPayload } from "../../types";
import { formatDateFR } from "../format";

/// Fabrique la règle. `sources` = liste des ids de champ à essayer dans
/// l'ordre. La première valeur non vide (après trim) est retenue et
/// formatée en `DD/MM/YYYY` avant stamping. Si toutes les sources sont
/// vides, la règle ne firera pas (whenFn retourne false).
export function dateHeaderFallback(opts: {
  widget: string;
  sources: readonly string[];
  name?: string;
}): MappingRule {
  const firstAvailable = (payload: FormPayload): string | null => {
    for (const id of opts.sources) {
      const v = payload[id];
      if (typeof v === "string" && v.trim() !== "") return v.trim();
    }
    return null;
  };
  return {
    name: opts.name ?? `date-header:${opts.widget}`,
    whenFn: (payload) => firstAvailable(payload) !== null,
    stampFn: (payload) => {
      const date = firstAvailable(payload);
      if (!date) return [];
      return [{ widget: opts.widget, value: formatDateFR(date) }];
    },
    declaredWidgets: [opts.widget],
  };
}
