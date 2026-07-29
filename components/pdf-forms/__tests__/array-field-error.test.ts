// Regression : un champ `array` requis et vide ne bloquait "Continuer" sans
// jamais afficher pourquoi (aucune prop d'erreur transmise a <ArrayField>,
// aucun rendu d'erreur dans le composant). Ce test fait tourner le VRAI
// validateur (lib/pdf-forms/validation.ts, non modifie) puis rend le VRAI
// <ArrayField> (react-dom/server, sans jsdom : ce projet n'a pas de
// dependance testing-library ni d'environnement jsdom configure — cf.
// vitest.config.ts, environment: "node") pour verifier que le message produit
// par le validateur atterrit bien dans le HTML, avec le meme contrat
// DOM/ARIA que les autres types de champ (id d'ancre pour scrollToField,
// aria-invalid, aria-describedby, role="alert" via <FieldError>).
//
// Aucun texte d'erreur n'est invente ici : le message affiche vient de
// validateStepFields (FALLBACK.required dans validation.ts), jamais tape en
// dur dans ce fichier.
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";

import messages from "@/messages/fr.json";
import { ArrayField } from "@/components/pdf-forms/array-field";
import { validateStepFields } from "@/lib/pdf-forms/validation";
import type { PdfFormField } from "@/lib/pdf-forms/types";
import type { PublicField } from "@/lib/pdf-forms/public-serializer";

/// Rend un element sous un NextIntlClientProvider FR (catalogue reel de
/// l'app, cf. import `messages` ci-dessus) — meme provider que le runtime.
function renderFr(field: PublicField, value: unknown, error: string | undefined) {
  return renderToStaticMarkup(
    createElement(
      NextIntlClientProvider,
      { locale: "fr", messages },
      createElement(ArrayField, {
        field,
        value: value as never,
        error,
        locale: "fr",
        onChange: () => {},
      }),
    ),
  );
}

describe("ArrayField — erreur d'un champ array requis (parite avec les autres types de champ)", () => {
  // Schema minimal calque sur natureActiviteIndependant / descriptionAide1
  // (lib/pdf-forms/seed/c1a-fields.ts) : type "array", required: true, une
  // seule ligne de sous-champ texte requis.
  const validatorField: PdfFormField = {
    id: "natureActiviteIndependant",
    pdfFieldName: "",
    type: "array",
    required: true,
    label: { fr: "Nature de l'activite de l'independant" },
    itemFields: [
      { id: "nature", pdfFieldName: "", type: "text", required: true, label: { fr: "Nature de l'activite" } },
    ],
  };
  const publicField: PublicField = {
    id: "natureActiviteIndependant",
    type: "array",
    required: true,
    label: { fr: "Nature de l'activite de l'independant" },
    itemFields: [
      { id: "nature", type: "text", required: true, label: { fr: "Nature de l'activite" } },
    ],
  };

  it("le validateur produit bien une erreur pour un tableau requis vide (base du contrat)", () => {
    const errors = validateStepFields([validatorField], {}, "fr");
    expect(errors.natureActiviteIndependant).toBeTruthy();
  });

  it("affiche cette erreur dans le meme composant que les autres champs, avec le contrat DOM/ARIA attendu", () => {
    const errors = validateStepFields([validatorField], {}, "fr");
    const message = errors.natureActiviteIndependant;
    expect(message).toBeTruthy();

    const html = renderFr(publicField, [], message);

    // Ancre DOM pour scrollToField (pdf-form-runner.tsx: attemptAdvance ->
    // scrollToField(firstInvalidFieldId) -> document.getElementById(id)).
    expect(html).toContain('id="natureActiviteIndependant"');
    // Meme composant de message que les champs normaux (FieldError,
    // components/ui/field.tsx) : role="alert" + le texte REEL du validateur,
    // jamais reecrit ici.
    expect(html).toContain('role="alert"');
    expect(html).toContain(message as string);
    // Ancrage accessible : le groupe se declare invalide et decrit par le
    // meme id que celui pose sur le message (cf. array-field.tsx: errorId).
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="natureActiviteIndependant-error"');
    expect(html).toContain('id="natureActiviteIndependant-error"');
  });

  it("une ligne fraichement ajoutee mais laissee vierge compte toujours comme non remplie (l'erreur reste affichee)", () => {
    // Reproduit le clic sur "+ Ajouter" (ArrayField.addRow) suivi d'un
    // "Continuer" sans rien saisir : une ligne vide represente exactement ce
    // que produit addRow() quand aucun itemField ne porte de defaultValue.
    const errors = validateStepFields([validatorField], { natureActiviteIndependant: [{}] }, "fr");
    const message = errors.natureActiviteIndependant;
    expect(message).toBeTruthy();

    const html = renderFr(publicField, [{}], message);
    expect(html).toContain('role="alert"');
    expect(html).toContain(message as string);
  });
});

describe("ArrayField — non-regression cohabitants (champ array facultatif)", () => {
  // Meme forme que le champ `cohabitants` du C1 (lib/pdf-forms/seed/c1/
  // famille.ts) : required: false. Rien ne doit changer pour lui : ce test
  // fige le comportement AVANT/APRES ce correctif.
  const validatorField: PdfFormField = {
    id: "cohabitants",
    pdfFieldName: "",
    type: "array",
    required: false,
    label: { fr: "Personnes avec qui je cohabite" },
    itemFields: [
      { id: "prenom", pdfFieldName: "", type: "text", required: true, label: { fr: "Prenom" } },
    ],
  };
  const publicField: PublicField = {
    id: "cohabitants",
    type: "array",
    required: false,
    label: { fr: "Personnes avec qui je cohabite" },
    itemFields: [
      { id: "prenom", type: "text", required: true, label: { fr: "Prenom" } },
    ],
  };

  it("le validateur ne produit aucune erreur pour un tableau facultatif vide", () => {
    const errors = validateStepFields([validatorField], {}, "fr");
    expect(errors.cohabitants).toBeUndefined();
  });

  it("ne rend aucun message d'erreur ni aria-invalid (comportement inchange)", () => {
    const errors = validateStepFields([validatorField], {}, "fr");
    const html = renderFr(publicField, [], errors.cohabitants);

    // L'ancre DOM reste posee (utile si un autre mecanisme de blocage cible
    // ce champ un jour), mais aucune trace d'etat invalide. On cible la
    // syntaxe d'ATTRIBUT (`aria-invalid="..."`) et non la simple
    // sous-chaine : le bouton "Ajouter" porte par ailleurs la classe
    // Tailwind "aria-invalid:border-destructive" (variante CSS), qui
    // contiendrait sinon un faux positif.
    expect(html).toContain('id="cohabitants"');
    expect(html).toContain('data-invalid="false"');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('aria-invalid="');
    expect(html).not.toContain('aria-describedby="');
  });
});
