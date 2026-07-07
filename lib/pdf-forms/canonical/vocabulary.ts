// Vocabulaire canonique — Phase 2 du plan pdf-bindings-canonical-ux.
//
// Priorité métier Oraliks : « il est illogique pour la personne de devoir
// remettre 2× la même information ». Quand un formulaire (C1) déclenche un
// sous-formulaire (C1A, C47, REGIS, PARTENAIRE…), les champs d'identité, de
// contact, d'adresse et de banque doivent arriver PRÉ-REMPLIS.
//
// Le vocabulaire canonique matérialise les CLÉS PARTAGÉES entre documents
// — le formulaire A pose `canonicalKey: "identity.nom"` sur son champ « Nom »,
// le formulaire B pose la même clé sur son champ « Nom », et l'extracteur
// (extract.ts) sait faire l'aller-retour A → B via cette clé unique.
//
// Discipline : rester MINIMAL. On ne canonise QUE les valeurs qui se
// partagent réellement (identité, adresse, contact, banque, statut famille).
// Les champs spécifiques à un document (motif d'introduction du C1, code lien
// familial…) ne rentrent PAS ici — ce serait une fausse promesse de
// portabilité.

export const CANONICAL_KEYS = [
  // Identité citoyenne — présente sur presque tous les formulaires ONEM.
  "identity.nom",
  "identity.prenom",
  "identity.niss",
  "identity.dateNaissance",
  "identity.nationalite",

  // Adresse — page 1 quasi-systématique (C1, C1A, C47…).
  "adresse.rue",
  "adresse.numero",
  "adresse.boite",
  "adresse.codePostal",
  "adresse.pays",

  // Contact — souvent facultatif mais partagé quand rempli.
  "contact.email",
  "contact.telephone",

  // Banque — mode de paiement des allocations (C1, changement, insertion).
  "banque.iban",
  "banque.bic",
  "banque.titulaire",

  // Statut famille — utile aux Annexes REGIS / composition de ménage.
  "famille.statut",
] as const;

export type CanonicalKey = (typeof CANONICAL_KEYS)[number];

/// Garde de type — un slug reçu du schéma (potentiellement d'une version
/// ancienne) est-il encore reconnu comme clé canonique ? Une clé inconnue est
/// simplement ignorée à l'extraction (safe par défaut, on ne perd rien).
export function isCanonicalKey(v: unknown): v is CanonicalKey {
  return typeof v === "string" && (CANONICAL_KEYS as readonly string[]).includes(v);
}
