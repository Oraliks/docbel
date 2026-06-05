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
/// Accepte `number` (ex. salaire) en plus de string/boolean.
export type DossierAnswers = Record<string, string | boolean | number | undefined>;

/// Une question d'orientation (mini-questionnaire qui sélectionne les docs).
export interface DossierQuestion {
  id: string;
  label: Localized;
  type: "select" | "boolean";
  /// Options pour `select`.
  options?: Array<{ value: string; label: Localized }>;
  /// La question ne s'affiche que si la fonction retourne true (réponses
  /// déjà saisies à ce stade). Absent = toujours visible.
  visibleWhen?: (answers: DossierAnswers) => boolean;
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
  /// Référence interne (jamais affichée publiquement) : sert à savoir où
  /// l'info / la règle d'inclusion vient (ex. "Doc formation §4.3").
  internalRef?: string;
}

/// Avertissement affiché au début du dossier.
export interface DossierWarning {
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  /// Filtrage conditionnel optionnel (ex. délai différent selon type CT).
  visibleWhen?: (answers: DossierAnswers) => boolean;
}

/// Audience autorisée à lire une section théorique.
/// - public  : visible sans authentification
/// - user    : utilisateur connecté lambda
/// - partner : partenaire métier (formateur, agent ONEM, etc.)
/// - admin   : équipe interne
export type TheoryAudience = "public" | "user" | "partner" | "admin";

/// Identifiants de "bindings" que le rendu Markdown peut interpoler depuis la
/// structure du dossier — permet aux sections théoriques de rester
/// automatiquement synchros quand on change le code.
export type TheoryBinding =
  | "motifs"           // liste des types/motifs du dossier
  | "documents"        // liste des documents du dossier
  | "questions"        // liste des questions d'orientation
  | "qui-est-concerne" // matrice motif → statuts autorisés
  | "delais"           // tableau des délais (si défini)
  | "nature-da";       // règles de calcul de la nature de DA

/// Une section de l'espace théorique d'un dossier.
/// Visible côté admin/partenaires. Sert à expliquer la sémantique du dossier
/// sans dupliquer la structure (laquelle vit en code, source de vérité).
export interface DossierTheorySection {
  id: string;
  title: string;
  /// Corps en Markdown rédigé EN INTERNE (paraphrase, jamais de citation
  /// verbatim d'une source non publique). Peut contenir des bindings sous
  /// la forme `{{ motifs }}` etc., remplacés au rendu par les listes
  /// extraites du module.
  body: string;
  /// Audiences autorisées à lire cette section.
  audience: TheoryAudience[];
  /// Bindings interpolés au rendu (cf. TheoryBinding).
  bindings?: TheoryBinding[];
  /// Référence interne (NEVER rendered to users) : pour retrouver d'où vient
  /// l'info dans nos sources de travail.
  internalRef?: string;
  /// Date de dernière revue (YYYY-MM-DD). Utile pour signaler quand un
  /// texte vieillit (changement de loi ONEM par ex.).
  lastReviewedAt?: string;
}

/// Référence vers une entrée du catalogue lookup-onem. Sert à deep-linker
/// depuis une procédure vers la table officielle des codes (préfixes, articles
/// d'admissibilité, codes CAD, etc.).
export interface LookupCodeRef {
  /// Slug de la `LookupTable` (ex. "s04-s36-prefixe-type-chomage").
  tableSlug: string;
  /// Code spécifique à mettre en évidence (ex. "02"). Si absent, le lien
  /// pointe vers la table entière.
  code?: string;
  /// Libellé à afficher (paraphrase métier — pas le label brut ONEM).
  label: string;
  /// Contexte d'usage optionnel (ex. "Temps plein", "Construction CP 124").
  context?: string;
}

/// Une étape opérationnelle d'introduction d'une demande, paraphrasée.
/// JAMAIS de détail des écrans/touches de l'outil interne syndical.
export interface ProcedureStep {
  order: number;
  title: string;
  /// Markdown court (1-3 phrases). Décrit l'action métier, pas la séquence
  /// clavier. Ex. "Importer l'occupation depuis le flux WECH 502 ; le
  /// programme calcule automatiquement le code chiffré."
  description: string;
  /// Moment dans le workflow ("création", "import flux", "validation finale"…).
  when?: string;
}

/// Formulaire évoqué dans la procédure (lien vers PdfForm interne si possible).
export interface ProcedureFormReference {
  /// Code officiel ou interne (ex. "WECH 502", "C3.2", "C32 travailleur").
  code: string;
  /// Libellé métier ("Demande à déclaration de l'employeur").
  label: string;
  /// Rôle dans le dossier ("demande", "paiement", "support", "contrôle").
  purpose: "demande" | "paiement" | "support" | "controle";
  /// Slug d'un `PdfForm` géré dans Beldoc, si on en a un. Sinon null.
  pdfFormSlug?: string;
  /// Mention de la référence officielle ONEM (ex. "C3.2 travailleur — papier").
  officialRef?: string;
}

/// Procédure opérationnelle d'introduction d'une demande pour une nature de DA
/// donnée (TEM / GRE / INT / CTP / …). Visible admin & partenaires uniquement.
/// Contenu rédigé EN INTERNE à partir de sources confidentielles (jamais de
/// reproduction verbatim).
export interface DossierProcedure {
  id: string;
  /// Code "nature de DA" ONEM (ex. "TEM"). Doit matcher `natureDA()` du dossier.
  natureDA: string;
  title: string;
  /// Résumé court (1-2 phrases), affichage liste.
  summary: string;
  audience: TheoryAudience[];
  /// Référence interne à la source (jamais affichée).
  internalRef?: string;
  /// Dernière revue (YYYY-MM-DD).
  lastReviewedAt?: string;
  /// Références réglementaires (articles d'AR, lois).
  reglementation?: string[];
  /// Conditions qui rendent la DA obligatoire (liste paraphrasée).
  conditionsObligatoire?: string[];
  /// Conditions qui la rendent facultative.
  conditionsFacultative?: string[];
  /// Délais d'introduction. Texte court, en mois.
  delais?: {
    obligatoire?: string;
    facultative?: string;
    exceptions?: string;
  };
  /// Formulaires à introduire (et formulaire de paiement le cas échéant).
  formulaires?: ProcedureFormReference[];
  /// Étapes opérationnelles, dans l'ordre. Paraphrasées.
  steps: ProcedureStep[];
  /// Codes ONEM référencés (deep-links vers le lookup).
  codeReferences?: LookupCodeRef[];
  /// Notes / remarques additionnelles (Markdown court).
  notes?: string;
}

/// Matrice « qui peut bénéficier de tel motif ».
/// Clé = id du motif (ex. "economique"), valeur = liste des statuts autorisés.
export type WhoConcernedMatrix = Record<string, Array<"ouvrier" | "employe" | "interimaire">>;

/// Fonction qui calcule la "nature de DA" (code ONEM) à partir des réponses.
/// Renvoie un objet { code, label } ou null si non déterminable encore.
export type NatureDAResolver = (
  answers: DossierAnswers
) => { code: string; label: string } | null;

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
  /// Les "types" du dossier (ex. les 11 motifs de chômage temporaire). Sert
  /// aussi à l'illustration animée de la page.
  types: string[];
  questions: DossierQuestion[];
  warnings: DossierWarning[];
  documents: DossierDocument[];
  /// Matrice motif → statuts éligibles (filtrage des options de motif selon
  /// le statut répondu).
  whoConcerned?: WhoConcernedMatrix;
  /// Calcul de la nature de DA (code ONEM).
  natureDA?: NatureDAResolver;
  /// Espace théorique pédagogique (admin / partenaires).
  theory?: DossierTheorySection[];
  /// Procédures opérationnelles d'introduction de la demande (admin / partenaires).
  /// Une procédure par "nature de DA" ONEM (TEM, GRE, INT, CTP…). Décrit ce
  /// qu'il faut faire — formulaires, délais, ordre, codes — sans le détail
  /// des écrans de l'outil interne syndical.
  procedures?: DossierProcedure[];
}

/// Calcule la liste des documents applicables pour des réponses données.
export function selectDocuments(def: DossierDefinition, answers: DossierAnswers): DossierDocument[] {
  return def.documents.filter((d) => (d.includeWhen ? d.includeWhen(answers) : true));
}

/// Filtre les options d'un motif (ou d'une question similaire) selon la
/// matrice `whoConcerned` du dossier et le statut déjà répondu. Utile dans
/// les questions d'orientation pour ne pas proposer "Économique" à un
/// employé, etc.
export function filterMotifOptions(
  def: DossierDefinition,
  motifIds: string[],
  statut: "ouvrier" | "employe" | "interimaire" | undefined
): string[] {
  if (!statut || !def.whoConcerned) return motifIds;
  return motifIds.filter((id) => def.whoConcerned![id]?.includes(statut));
}
