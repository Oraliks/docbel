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
const COLONNE_X = 300;

/// Tolérance verticale, en points. Deux widgets d'une même ligne imprimée ne
/// sont pas exactement à la même hauteur (une case à cocher est plus petite
/// qu'une ligne de texte) : sans marge, une ligne « lundi ☐ ☐ ☐ » lèverait une
/// fausse alerte.
const TOLERANCE_Y = 12;

interface Cible {
  slug: string;
  pdf: string;
  improve: (fields: PdfFormField[], ctx?: { technicalSchema: AcroFieldRaw[] }) => PdfFormField[];
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
  { slug: "c1-partenaire", pdf: "C1-Partenaire_FR.pdf", improve: applyC1PartenaireImprovements },
  { slug: "c1a", pdf: "C1A_FR.pdf", improve: applyC1AImprovements },
  { slug: "c1b", pdf: "C1B_FR.pdf", improve: applyC1BImprovements },
  { slug: "c1c", pdf: "C1C_FR.pdf", improve: applyC1CImprovements },
  { slug: "c46", pdf: "C46_FR.pdf", improve: applyC46Improvements },
  { slug: "c47", pdf: "C47_FR.pdf", improve: applyC47Improvements },
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
  "c1-partenaire": [
    "montant_mensuel_brut > partenaireRevenuRemplacement",
    "partenaireAllocationsFamiliales > aujourd_hui",
    "partenaireRevenuProfessionnel > m_tier",
    "partenaireRevenuRemplacement > revenu_de_remplacement",
  ],
  c1b: ["niss > nom"],
  c1c: [
    "adresseActiviteLigne1 > adresseActiviteLigne2",
    "affirmationSincereEtComplete > annexes",
    "dateDebutActivite > descriptionActivite1",
    "nomEntreprise > formeExerciceAutre",
    "revenuNetImposableAnnuel > activiteIndependanteAnterieure",
    "siteInternetUrl > lieuExerciceActivite",
  ],
  c46: ["niss > lorganismes_suivants", "nominations_suivantes_5 > date39_af_date"],
  c47: ["niss > t_l_phone"],
};

interface Ancre {
  id: string;
  order: number;
  page: number;
  colonne: number;
  y: number;
}

/// Ancre géométrique d'un champ : la position de son widget. `null` si le champ
/// n'a pas de widget exploitable (champ virtuel, `drawAt`, widget absent du
/// PDF, ou masqué — un champ masqué n'est jamais stampé).
function ancre(field: PdfFormField, widgets: Map<string, AcroFieldRaw>): Ancre | null {
  if (field.hidden) return null;
  if (!field.pdfFieldName) return null;
  // Un `pdfFieldName` en "a|b|c" désigne N cases (radio sur N cases distinctes) :
  // on s'ancre sur la première, les autres sont adjacentes.
  const premier = field.pdfFieldName.split("|")[0];
  if (!premier) return null;
  const w = widgets.get(premier);
  if (!w || w.page === undefined || !w.rect) return null;
  const [x, y] = w.rect;
  return {
    id: field.id,
    order: field.order ?? 0,
    page: w.page,
    colonne: x < COLONNE_X ? 0 : 1,
    y,
  };
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

      const ancres = fields
        .map((f) => ancre(f, widgets))
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
