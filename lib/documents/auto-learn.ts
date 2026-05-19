import { prisma } from "@/lib/prisma";
import type { DocumentField } from "./types";

/// Labels génériques / placeholders qu'on **ne** veut PAS mémoriser :
/// ils n'apportent aucun signal utile pour les futures détections.
const PLACEHOLDER_LABELS = /^(champ détecté|champ|case|date|nouveau champ|—|\(sans libellé\)|signature)$/i;

export interface AutoLearnResult {
  added: number;
  updated: number;
  skipped: number;
}

/// Persiste les paires `label → type + preset` du schema d'un template dans
/// `OcrCorrectionMemory`. Appelé automatiquement après chaque save de template
/// quand le schema change — fait grossir la mémoire sans intervention manuelle.
///
/// **Pourquoi** : la mémoire de corrections (`OcrCorrectionMemory`) sert au fuzzy
/// match lors des futures auto-détections sur d'autres PDFs. Si un admin nettoie
/// proprement "Numéro NISS (*)" → "Numéro NISS" + type=niss + preset=NISS belge,
/// la prochaine détection du même label (ou d'un label proche) hérite
/// instantanément des bonnes méta-données. Avant cette fonction, l'admin
/// devait cliquer "Apprendre" manuellement — désormais c'est automatique.
///
/// **Idempotent** : si une entrée (templateId, rawLabel, cleanLabel) existe
/// déjà, on incrémente seulement `occurrences` (et on met à jour le type/preset
/// au cas où). Sinon on crée. Pas de doublons.
export async function autoLearnFromSchema(
  templateId: string,
  schema: DocumentField[],
  createdBy?: string | null
): Promise<AutoLearnResult> {
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const field of schema) {
    const label = (field.label || "").trim();
    // Skip labels trop courts ou trop génériques
    if (!label || label.length < 3) {
      skipped++;
      continue;
    }
    if (PLACEHOLDER_LABELS.test(label)) {
      skipped++;
      continue;
    }

    try {
      const existing = await prisma.ocrCorrectionMemory.findFirst({
        where: {
          templateId,
          rawLabel: label,
          cleanLabel: label,
        },
      });
      if (existing) {
        await prisma.ocrCorrectionMemory.update({
          where: { id: existing.id },
          data: {
            occurrences: { increment: 1 },
            fieldType: field.type,
            presetId: field.presetId ?? null,
          },
        });
        updated++;
      } else {
        await prisma.ocrCorrectionMemory.create({
          data: {
            templateId,
            rawLabel: label,
            cleanLabel: label,
            fieldType: field.type,
            presetId: field.presetId ?? null,
            createdBy: createdBy ?? null,
          },
        });
        added++;
      }
    } catch (err) {
      // Best-effort : ne jamais casser la sauvegarde du template pour un échec mémoire
      console.warn("autoLearnFromSchema: skip", label, err);
      skipped++;
    }
  }

  return { added, updated, skipped };
}
