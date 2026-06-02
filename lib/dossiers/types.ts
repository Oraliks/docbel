// Définition d'un "dossier" (ex. chômage temporaire, chômage complet).
//
// Chaque dossier est un MODULE indépendant (lib/dossiers/<slug>/index.ts) qui
// décrit : ses questions d'orientation, ses documents, quels documents
// s'appliquent selon les réponses, et ses avertissements. Les CHAMPS des
// documents référencent le catalogue partagé (lib/fields/catalog.ts) pour que
// les données communes (NISS, adresse…) soient réutilisées et propagées.
//
// Deux dossiers (temporaire vs complet) n'ont aucune dépendance entre eux :
// ils partagent seulement le noyau (runner, page, validation) et le catalogue.

import type { CanonicalKey } from "@/lib/fields/catalog";
import type { Localized } from "@/lib/pdf-forms/types";

/// Réponses aux questions d'orientation : { [questionId]: valeur }.
export type DossierAnswers = Record<string, string | boolean | undefined>;

/// Une question d'orientation (mini-questionnaire qui sélectionne les docs).
export interface DossierQuestion {
  id: string;
  label: Localized;
  type: "select" | "boolean";
  /// Options pour `select`.
  options?: Array<{ value: string; label: Localized }>;
}

/// Un champ d'un document : soit une référence au catalogue, soit un champ
/// propre au document (custom).
export type DossierFieldRef =
  | {
      /// Champ canonique partagé (NISS, adresse…).
      field: CanonicalKey;
      required?: boolean;
      section?: string;
      /// Surcharge optionnelle du nom AcroForm réel du PDF officiel.
      pdfFieldName?: string;
    }
  | {
      /// Champ propre au document (pas dans le catalogue).
      custom: {
        key: string;
        pdfFieldName: string;
        type: import("@/lib/pdf-forms/types").FieldType;
        label: Localized;
      };
      required?: boolean;
      section?: string;
    };

/// Un document du dossier.
export interface DossierDocument {
  slug: string;
  title: string;
  issuer: string;
  /// Document obligatoire dans le dossier (si inclus).
  required?: boolean;
  /// Inclusion conditionnelle selon les réponses d'orientation. Absent =
  /// toujours inclus.
  includeWhen?: (answers: DossierAnswers) => boolean;
  fields: DossierFieldRef[];
  /// Chemin (relatif à la racine du projet) vers le PDF source officiel.
  /// Si fourni, le seed l'utilise comme source du PdfForm (au lieu de
  /// générer un gabarit). Les `fields` doivent alors fournir un
  /// `pdfFieldName` qui matche les widgets réels du PDF.
  sourcePdfPath?: string;
}

/// Avertissement affiché au début du dossier.
export interface DossierWarning {
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
}

export interface DossierDefinition {
  slug: string;
  title: string;
  description: string;
  /// Catégorie d'événement de vie (pour /creer-ma-demande).
  category: string;
  icon: string;
  color: string;
  /// Synonymes pour la recherche libre.
  vocabularyTags: string[];
  /// Les "types" du dossier (ex. les 7 motifs de chômage temporaire). Sert
  /// aussi à l'illustration animée de la page.
  types: string[];
  questions: DossierQuestion[];
  warnings: DossierWarning[];
  documents: DossierDocument[];
}

/// Calcule la liste des documents applicables pour des réponses données.
export function selectDocuments(def: DossierDefinition, answers: DossierAnswers): DossierDocument[] {
  return def.documents.filter((d) => (d.includeWhen ? d.includeWhen(answers) : true));
}
