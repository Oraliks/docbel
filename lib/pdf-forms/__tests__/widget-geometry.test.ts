import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parsePdf } from "../acroform-parser";
import type { AcroFieldRaw, PdfFormField } from "../types";

import { applyC1Improvements } from "../seed/c1-fields-improvements";
import { applyC1RegisImprovements } from "../seed/c1-regis-fields";
import { applyC1PartenaireImprovements } from "../seed/c1-partenaire-fields";
import { applyC1AImprovements } from "../seed/c1a-fields";
import { applyC1BImprovements } from "../seed/c1b-fields";
import { applyC1CImprovements } from "../seed/c1c-fields";
import { applyC46Improvements } from "../seed/c46-fields";
import { applyC47Improvements } from "../seed/c47-fields";

/// Géométrie seed ↔ PDF réel.
///
/// Dans les AcroForms de l'ONEM, un widget porte le nom du texte imprimé JUSTE
/// AU-DESSUS de lui, pas celui de la donnée qu'il reçoit : la case
/// « Nom employeur » du C1A est la ligne de l'ADRESSE. Associer les champs aux
/// widgets par ressemblance de libellé produit donc un décalage d'une ligne,
/// que `seeds-vs-pdf` ne voit pas (il vérifie qu'un nom existe, jamais qu'il
/// désigne la bonne case).
///
/// Invariant vérifié ici : un formulaire papier se lit dans un ordre, et les
/// champs du schéma sont numérotés dans ce même ordre. Si le champ n°63 pointe
/// vers une case plus BASSE que celle du champ n°65, la correspondance est
/// fausse. Aucune connaissance métier requise — c'est de la géométrie.
///
/// Mise en page à deux colonnes : on lit la gauche de haut en bas, puis la
/// droite. L'ancre de tri est donc (page, colonne, -y).

const PDF_DIR = join(process.cwd(), "private", "pdfs");

/// Abscisse de séparation des colonnes, en points. A4 = 595 pt de large.
/// Valeur par défaut ; un formulaire peut la redéfinir, ou déclarer qu'il n'a
/// PAS deux colonnes (cf. `colonneX` sur `Cible`).
const COLONNE_X = 300;

/// Tolérance verticale, en points. Deux widgets d'une même ligne imprimée ne
/// sont pas exactement à la même hauteur (une case à cocher est plus petite
/// qu'une ligne de texte) : sans marge, une ligne « lundi ☐ ☐ ☐ » lèverait une
/// fausse alerte. Autre cas : une case de signature est plus haute qu'une
/// ligne de date, et l'ancre est le bas du rectangle : sur la ligne
/// « date | signature » du C1A les deux rectangles sont distants de 13
/// points alors qu'ils sont imprimés côte à côte.
const TOLERANCE_Y = 16;

interface Cible {
  slug: string;
  pdf: string;
  improve: (fields: PdfFormField[], ctx?: { technicalSchema: AcroFieldRaw[] }) => PdfFormField[];
  /// Abscisse de séparation des colonnes. `null` = le formulaire n'a qu'UNE
  /// colonne de saisie, l'ordre de lecture est donc purement vertical.
  /// Absent = `COLONNE_X`.
  ///
  /// Ce n'est pas un assouplissement : appliquer un découpage en deux colonnes
  /// à un document qui n'en a qu'une le coupe en plein milieu et invente des
  /// écarts là où l'ordre déclaré est juste — pendant que les vrais décalages
  /// verticaux, eux, passent inaperçus dans le bruit.
  colonneX?: number | null;
}

const CIBLES: Cible[] = [
  {
    slug: "c1-changement-situation",
    pdf: "C1_FR.pdf",
    improve: (fields, ctx) =>
      applyC1Improvements(fields, {
        defaultMotif: "modification",
        restrictMotifTo5Situations: true,
        technicalSchema: ctx?.technicalSchema,
      }),
  },
  { slug: "c1-regis", pdf: "Annexe_Regis_FR.pdf", improve: applyC1RegisImprovements },
  {
    slug: "c1-partenaire",
    pdf: "C1-Partenaire_FR.pdf",
    improve: applyC1PartenaireImprovements,
    // Une seule colonne de saisie, comme le C1C et le C47 : le texte des six
    // questions court sur toute la largeur et ses cases « non »/« oui » sont
    // simplement rejetées à droite (x=480 et x=531) SUR LA MÊME LIGNE imprimée.
    // Le seuil de 300 pt en faisait une « colonne de droite » et déclarait
    // écart chaque retour à la ligne suivante — pendant qu'il MASQUAIT un vrai
    // décalage : la date d'en-tête (x=338, y=743) était déclarée après
    // l'identité (y=532) et passait pour « colonne suivante ». Cf. l'ordre
    // -101 de `dateDA`.
    colonneX: null,
  },
  { slug: "c1a", pdf: "C1A_FR.pdf", improve: applyC1AImprovements },
  { slug: "c1b", pdf: "C1B_FR.pdf", improve: applyC1BImprovements },
  {
    slug: "c1c",
    pdf: "C1C_FR.pdf",
    improve: applyC1CImprovements,
    // Le C1C n'a qu'une colonne de saisie : ses 36 widgets vivent tous entre
    // x=211 et x=430, la marge de gauche (x=56 à 205) ne portant que du texte
    // d'aide imprimé. Le seuil par défaut de 300 pt coupait donc cette unique
    // colonne en deux et déclarait « écart » six paires dont l'ordre est juste
    // (date de début vs description, ligne 1 vs ligne 2 d'une même adresse…).
    colonneX: null,
  },
  {
    slug: "c46",
    pdf: "C46_FR.pdf",
    improve: applyC46Improvements,
    // Une seule colonne de saisie : les 13 widgets vivent entre x=216 et x=577,
    // la marge de gauche ne portant que du texte d'aide imprimé. Le seuil de
    // 300 pt coupait la colonne entre les lignes d'organisme (x=216) et les
    // guides de date (x=291), inventant un écart à chaque bloc de mandat.
    colonneX: null,
  },
  {
    slug: "c47",
    pdf: "C47_FR.pdf",
    improve: applyC47Improvements,
    // Même situation que le C1C : une seule colonne de saisie. Les 11 widgets
    // du C47 vivent entre x=210 (les cases à cocher) et x=423 (la signature),
    // la marge de gauche ne portant que du texte d'aide imprimé. Le seuil par
    // défaut de 300 pt coupait cette unique colonne entre le NISS (x=318) et le
    // téléphone (x=285) et déclarait « écart » deux champs dont l'ordre est
    // juste — le NISS est bien AU-DESSUS du téléphone sur le papier.
    colonneX: null,
  },
];

/// Écarts connus et assumés, par slug : `"champA > champB"` signifie que le
/// champ A est déclaré AVANT B mais pointe vers une case située après lui dans
/// l'ordre de lecture.
///
/// Une entrée ici est une DETTE, pas une exemption : elle documente un
/// formulaire dont le mapping n'a pas encore été réaligné. Les six compagnons
/// autres que le C1A ont été écrits avec la même méthode et présentent
/// probablement le même défaut ; leurs écarts sont consignés ici pour être
/// traités formulaire par formulaire, hors de ce lot.
const ECARTS_ASSUMES: Record<string, string[]> = {
  // Dette : ces sept formulaires ont été écrits avec la même méthode que le
  // C1A et présentent le même défaut (cf. en-tête du fichier). Consignés ici
  // pour être réalignés formulaire par formulaire, hors de ce lot. `c1a` est
  // volontairement ABSENT de cette liste : c'est le formulaire que ce lot
  // répare, son test doit rester rouge jusqu'à la tâche suivante.
  "c1-changement-situation": [
    "activiteAccessoireDejaDeclare > administrateurSociete",
    "administrateurSocieteDejaDeclare > independantAccessoireOuPrincipal",
    "annexeAutreDescription > signature",
    "apprentissageAlternanceDate > formationStageSyntra",
    "bic > autoriseCotisationSyndicale",
    "cotisationSyndicaleMoisAnnee > nationaliteHorsEEE",
    "dateCreationDossier > motifIntroduction",
    "etudesPleinExerciceDate > apprentissageAlternance",
    "formationStageSyntraDate > mandatArtistique",
    "incapacite33 > affirmationSincerite",
    "independantAccessoireDejaDeclare > pensionCategorieParticuliere",
    "mandatArtistiqueDejaDeclare > mandatPolitique",
    "mandatPolitiqueDejaDeclare > chapitreXIIArts",
    "modificationCompte > statutFamilial",
    "modificationSituationFamiliale > modificationPermisSejour",
    "motifIntroduction > modificationAdresse",
    "nationaliteHorsEEE > statutRefugie",
    "num_ro_de_bo_te > pays",
    "pensionRetraiteDejaDeclare > indemniteMaladieInvalidite",
    "pr_nom > niss",
    "statutJugementPensionAlimentaire > separeDeFaitDelegationRevenu",
    "tremplinIndependantsDejaDeclare > activiteAccessoireOuAide",
  ],
  "c1-regis": [
    "adresseDifference > adresseC1",
    "adresseRegistre > adresseExplication",
    "nationaliteDifference > nationaliteC1",
    "nationaliteRegistre > nationaliteExplication",
    "personne1Difference > personne1C1",
    "personne1Registre > personne1Explication",
    "personne2Difference > personne2C1",
    "personne2Registre > personne2Explication",
    "personne3Difference > personne3C1",
    "personne3Registre > personne3Explication",
    "personne4Difference > personne4C1",
    "personne4Registre > personne4Explication",
    "personne5Difference > personne5C1",
    "personne5Registre > personne5Explication",
  ],
  // `c1-partenaire` : entrée VIDÉE le 2026-07-31 (reprise du formulaire). Ses
  // trois écarts étaient des artefacts du découpage en deux colonnes — cf.
  // `colonneX: null` sur sa cible. Le doute de fond sur son widget partagé
  // « Montant mensuel brut » est tranché (deux cases, deux valeurs : écriture
  // positionnelle), et le vrai décalage que le découpage MASQUAIT — la date
  // d'en-tête déclarée après l'identité — est corrigé dans le seed.
  // `c1b` : le formulaire a été remappé le 2026-07-31 (ses six dates
  // partagées sont passées en positionnel), mais cet écart-ci RESTE, et il
  // n'est pas un défaut de mapping : le champ `NISS` porte DEUX widgets — la
  // case d'identité de la page 1 et le rappel d'en-tête de la page 2 — ce qui
  // est voulu (même valeur aux deux endroits, cf. le même cas sur le C1C). Le
  // parser ne garde qu'un rectangle par NOM de champ, et c'est celui de la
  // page 2 : le test croit donc que le NISS se lit après le nom. Rien à
  // corriger dans le seed ; ce serait au parser d'exposer tous les widgets.
  c1b: ["niss > nom"],
  // `c1c` : entrée VIDÉE le 2026-07-30 (réalignement du formulaire). Ses six
  // écarts étaient tous des artefacts du découpage en deux colonnes appliqué à
  // un document qui n'en a qu'une — cf. `colonneX: null` sur sa cible. Le
  // mapping, lui, portait de vrais défauts, corrigés dans le seed.
  // Ne rien réintroduire ici sans avoir relu le PDF généré.
  // `c46` : entrée VIDÉE le 2026-07-31 (remappage du formulaire). Son second
  // écart, `nominations_suivantes_5 > date39_af_date`, n'était pas un décalage
  // d'ordre mais le symptôme du VRAI défaut : `date39_af_date`, libellé « date
  // de signature » et rangé en fin de formulaire, pointait en réalité sur les
  // trois guides « Moniteur Belge du » du HAUT de la page 1. Cf. l'en-tête de
  // `seed/c46-fields.ts`.
  // `c47` : entrée VIDÉE le 2026-07-30 (reprise du formulaire). Son unique
  // écart, `niss > t_l_phone`, était un artefact du découpage en deux colonnes
  // appliqué à un document qui n'en a qu'une — cf. `colonneX: null` sur sa
  // cible. Le mapping, lui, portait un vrai défaut (case « art. 114 »
  // impossible à cocher), corrigé dans le seed.
};

interface Ancre {
  id: string;
  order: number;
  page: number;
  colonne: number;
  y: number;
}

/// Ancre géométrique d'un champ : la position de sa PREMIÈRE case sur le
/// papier. `null` si le champ n'a rien à écrire (champ virtuel, widget absent
/// du PDF, ou masqué — un champ masqué n'est jamais stampé).
///
/// Trois sources, dans l'ordre où le filler les consulte :
///   • `pdfFieldName` — le cas courant. En "a|b|c" (radio sur N cases
///     distinctes) on s'ancre sur la première, les autres sont adjacentes.
///   • `drawAt` — écriture positionnelle, pour les cases qu'aucun widget ne
///     peut revendiquer (widget partagé entre plusieurs emplacements).
///   • `lineTargets` — textarea replié sur N lignes pointillées : la 1re ligne
///     donne la position du champ.
/// Sans ces deux derniers replis, un formulaire perdait toute couverture
/// géométrique dès qu'il passait en positionnel — soit précisément là où le
/// risque de décalage est le plus élevé.
function ancre(
  field: PdfFormField,
  widgets: Map<string, AcroFieldRaw>,
  colonneX: number | null,
): Ancre | null {
  if (field.hidden) return null;

  const colonneDe = (x: number) => (colonneX === null ? 0 : x < colonneX ? 0 : 1);
  const situer = (page: number, x: number, y: number): Ancre => ({
    id: field.id,
    order: field.order ?? 0,
    page,
    colonne: colonneDe(x),
    y,
  });

  const parWidget = (nom: string | undefined): Ancre | null => {
    const premier = nom?.split("|")[0];
    if (!premier) return null;
    const w = widgets.get(premier);
    if (!w || w.page === undefined || !w.rect) return null;
    return situer(w.page, w.rect[0], w.rect[1]);
  };

  const direct = parWidget(field.pdfFieldName);
  if (direct) return direct;

  if (field.drawAt) return situer(field.drawAt.page, field.drawAt.x, field.drawAt.y);

  const premiereLigne = field.lineTargets?.[0];
  if (premiereLigne) {
    const parLigne = parWidget(premiereLigne.pdfFieldName);
    if (parLigne) return parLigne;
    if (premiereLigne.drawAt) {
      return situer(premiereLigne.drawAt.page, premiereLigne.drawAt.x, premiereLigne.drawAt.y);
    }
  }

  return null;
}

/// Vrai si `b` vient après `a` dans l'ordre de lecture du document.
function suitEnLecture(a: Ancre, b: Ancre): boolean {
  if (b.page !== a.page) return b.page > a.page;
  if (b.colonne !== a.colonne) return b.colonne > a.colonne;
  // Même colonne : on descend, donc y diminue.
  return b.y <= a.y + TOLERANCE_Y;
}

describe("géométrie seed ↔ PDF — l'ordre déclaré suit l'ordre de lecture", () => {
  for (const cible of CIBLES) {
    const path = join(PDF_DIR, cible.pdf);

    it(`${cible.slug} (${cible.pdf})`, async ({ skip }) => {
      if (!existsSync(path)) skip();

      const parsed = await parsePdf(readFileSync(path));
      const widgets = new Map(parsed.fields.map((f) => [f.pdfFieldName, f]));
      const fields = cible.improve([], { technicalSchema: parsed.fields });

      const colonneX = cible.colonneX === undefined ? COLONNE_X : cible.colonneX;
      const ancres = fields
        .map((f) => ancre(f, widgets, colonneX))
        .filter((a): a is Ancre => a !== null)
        .sort((a, b) => a.order - b.order);

      const ecarts: string[] = [];
      for (let i = 1; i < ancres.length; i++) {
        const precedent = ancres[i - 1];
        const courant = ancres[i];
        if (!suitEnLecture(precedent, courant)) {
          ecarts.push(`${precedent.id} > ${courant.id}`);
        }
      }

      expect(
        ecarts.sort(),
        `${cible.slug} : champs dont la case remonte dans le document`,
      ).toEqual((ECARTS_ASSUMES[cible.slug] ?? []).slice().sort());
    });
  }
});
