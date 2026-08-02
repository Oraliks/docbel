// Partie serveur de la feuille de route : extrait le CP des payloads du run
// (une requête pdfForm.fields, même patron que regenerate-pdfs.ts) puis
// résout les bureaux OP compétents pour la commune. On n'appelle JAMAIS
// resolveBureausForPostalCode avec un organismePaiement : le choix d'OP est
// un state client (spec, art. 9) — le serveur renvoie les 4 bureaux, le
// client filtre. Renvoie null (→ mode générique) si rien d'extractible.

import { prisma } from "@/lib/prisma";
import { resolveBureausForPostalCode } from "@/lib/bureaus/resolve";
import type { DossierState } from "@/lib/bundles/completion";
import type { PdfFormField } from "@/lib/pdf-forms/types";
import { isOpCode, type BureauFeuille, type FeuilleServerData } from "./model";
import { postalCodeFromPayloads } from "./extract-postal";

export async function feuilleServerDataForState(
  state: DossierState,
): Promise<FeuilleServerData | null> {
  const ids = state.items
    .map((it) => it.pdfFormId)
    .filter((x): x is string => typeof x === "string" && x.length > 0);
  if (ids.length === 0) return null;

  const forms = await prisma.pdfForm.findMany({
    where: { id: { in: ids } },
    select: { id: true, fields: true },
  });
  const pairs = forms.flatMap((f) => {
    const payload = state.payloads[f.id];
    if (!payload) return [];
    return [{ fields: (f.fields as unknown as PdfFormField[]) || [], payload }];
  });

  const cp = postalCodeFromPayloads(pairs);
  if (!cp) return null;

  const resolved = await resolveBureausForPostalCode(cp);
  const bureauxParOp: BureauFeuille[] = resolved.attitre.organismesPaiement.flatMap((b) =>
    isOpCode(b.organismeCode)
      ? [
          {
            opCode: b.organismeCode,
            nom: b.name,
            adresse: b.fullAddress,
            telephone: b.phone,
            siteWeb: b.website,
            rendezVousUrl: b.appointmentUrl,
          },
        ]
      : [],
  );

  return { communeName: resolved.commune?.nameFr ?? null, bureauxParOp };
}
