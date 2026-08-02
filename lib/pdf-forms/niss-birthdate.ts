import { diagnoseNISS } from "./validators";

export interface NissBirthDate {
  /// Date de naissance complète (YYYY-MM-DD), ou null si le NISS encode une
  /// date incomplète/inconnue (cf. T.I. 000 — Registre national : jour et/ou
  /// mois "00" pour une date de naissance partielle, ou date fictive
  /// 01/00/1900 ou 01/00/2000 si totalement inconnue à la collecte).
  iso: string | null;
}

/// Extrait la date de naissance encodée dans un NISS valide (T.I. 000 — Le
/// numéro d'identification du Registre national) : les 6 premiers chiffres
/// sont AAMMJJ. Le siècle (19xx vs 20xx) se déduit de LA BRANCHE DE CHECKSUM
/// qui valide le numéro — `diagnoseNISS` teste déjà les deux (avec/sans
/// préfixe "2" pour les naissances ≥ 2000), donc on refait le même calcul ici
/// pour savoir laquelle a matché, sans dupliquer la validation elle-même.
///
/// Simplification volontaire : les dossiers 18XX et 19XX partagent la même
/// série de rang d'inscription (indiscernables depuis le seul NISS) — on
/// retient toujours 19xx pour la branche "sans préfixe 2", puisqu'un
/// dossier ONEM actif né avant 1900 est en pratique impossible.
///
/// Renvoie `null` si le NISS lui-même est invalide (longueur/checksum) —
/// à distinguer de `{ iso: null }` (NISS valide mais date incomplète/inconnue).
export function deriveBirthDateFromNiss(raw: string): NissBirthDate | null {
  const diag = diagnoseNISS(raw);
  if (!diag.ok) return null;

  const digits = raw.replace(/[^0-9]/g, "");
  const base = digits.slice(0, 9);
  const check = parseInt(digits.slice(9, 11), 10);
  const yy = base.slice(0, 2);
  const mm = base.slice(2, 4);
  const dd = base.slice(4, 6);

  const beforeMatches = 97 - (parseInt(base, 10) % 97) === check;
  const century = beforeMatches ? 1900 : 2000;

  // Date de naissance incomplète ou fictive (T.I. 000, p.2) : jour et/ou
  // mois à "00" — impossible de produire une date complète.
  if (mm === "00" || dd === "00") return { iso: null };

  const month = parseInt(mm, 10);
  const day = parseInt(dd, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return { iso: null };

  const year = century + parseInt(yy, 10);
  const d = new Date(Date.UTC(year, month - 1, day));
  // Rejette les dates calendaires impossibles (ex. 30 février) : si la date
  // reconstruite ne correspond pas exactement, JS l'a "roulée" sur le mois
  // suivant.
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return { iso: null };
  }
  // Naissance DANS LE FUTUR : la lecture du numéro est fausse, pas l'état civil
  // du citoyen. Un numéro inventé ou mal recopié a environ une chance sur 97 de
  // satisfaire la branche 20xx par hasard ; quand ses deux premiers chiffres
  // dépassent l'année en cours, on obtenait une date à venir — « 2078-11-02 »
  // relevé le 2026-08-02 en remplissant le C1 à l'écran. Le champ « date de
  // naissance » étant dérivé et verrouillé, le citoyen ne pouvait ni la voir
  // venir ni la corriger : elle partait telle quelle sur la déclaration.
  //
  // On rend `{ iso: null }` (même régime que les dates incomplètes du T.I. 000)
  // plutôt que `null` : le NISS reste valide au sens du checksum, c'est la date
  // qu'on refuse d'affirmer. Le champ redevient éditable.
  // Borne = fin du jour CIVIL LOCAL, projetée en UTC. L'ancienne borne
  // (`setUTCHours(23,59,59)` sur l'instant courant) vivait dans le jour UTC :
  // entre 00h00 et 02h00 heure belge (UTC+2), « aujourd'hui » local est
  // encore « demain » pour UTC, et une naissance du jour même était rejetée
  // — vu le 2026-08-03 à 00h04, suite de tests rouge sur « laisse passer une
  // naissance du jour même ». `d` étant à minuit UTC du jour encodé, la
  // comparaison calendrier-local contre calendrier-encodé est exacte des deux
  // côtés de la borne.
  const maintenant = new Date();
  const finDuJour = Date.UTC(
    maintenant.getFullYear(),
    maintenant.getMonth(),
    maintenant.getDate(),
    23, 59, 59, 999,
  );
  if (d.getTime() > finDuJour) return { iso: null };
  return { iso: `${year}-${mm}-${dd}` };
}
