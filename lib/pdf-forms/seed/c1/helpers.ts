// Façade historique : le contenu vit désormais dans `../_shared/moules.ts`,
// partagé avec les sept formulaires compagnons. Six modules `c1/*` importent
// depuis ici, et rien ne justifiait de leur faire changer d'adresse.

export {
  SECTION_IDENTITE,
  SECTION_DEMANDE,
  SECTION_SITUATION_FAMILIALE,
  SECTION_ACTIVITES,
  SECTION_REVENUS,
  SECTION_PAIEMENT,
  SECTION_COTISATION,
  SECTION_NON_EEE,
  SECTION_DIVERS,
  SECTION_AFFIRMATIONS,
  SECTION_ANNEXES,
  SECTION_SIGNATURE,
  YN,
  YN_DECLARE,
  dateAPartirDu,
  COMB_DATE_C1,
  annexeJointe,
  ouiNon,
  dejaDeclare,
} from "../_shared/moules";
