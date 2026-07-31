// L'encart `notice` d'un champ : rien tant que la question n'a pas de réponse,
// puis l'encart bleu sous le contrôle.
//
// Le C47 en est le premier porteur : son PDF imprime « Document à joindre :
// certificat médical… » sous les deux cadres de la demande, et l'écran ne le
// disait nulle part. Ce test rend le VRAI <PdfField> avec le VRAI champ du seed
// (react-dom/server, sans jsdom — même dispositif que array-field-error.test.ts,
// ce projet n'a ni testing-library ni environnement jsdom).
//
// Aucun texte n'est retapé ici : la phrase attendue est lue dans le seed, dont
// c47-fields.test.ts vérifie par ailleurs qu'elle est bien celle du PDF.
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";

import messages from "@/messages/fr.json";
import { PdfField } from "@/components/pdf-forms/pdf-field";
import { toPublicField } from "@/lib/pdf-forms/public-serializer";
import { C47_FIELDS } from "@/lib/pdf-forms/seed/c47-fields";
import type { FieldValue } from "@/lib/pdf-forms/types";

const cadreDemande = C47_FIELDS.find((f) => f.id === "cadreDemande")!;
const phrase = cadreDemande.notice!.text.fr!;

/// La phrase telle qu'elle apparaît dans le HTML rendu. React échappe le texte
/// qu'il insère : la chaîne brute ne s'y trouve JAMAIS telle quelle dès qu'elle
/// contient une apostrophe — et celle-ci en contient trois. Sans cette
/// conversion, l'assertion « absente » passerait pour de mauvaises raisons.
const dansLeHtml = phrase
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#x27;");

function renderFr(value: FieldValue) {
  return renderToStaticMarkup(
    // `children` passe par les props, comme dans array-field-error.test.ts : le
    // type de NextIntlClientProvider EXIGE la propriété, et la forme variadique
    // de createElement ne satisfait alors plus sa surcharge TS. Le fichier est
    // en `.ts` (le pattern de vitest.config.ts n'inclut pas `.tsx`), donc pas
    // de JSX pour trancher. La règle est désactivée ici seule, faute de forme
    // qui satisfasse les deux vérificateurs à la fois.
    // eslint-disable-next-line react/no-children-prop
    createElement(NextIntlClientProvider, {
      locale: "fr",
      messages,
      children: createElement(PdfField, {
        // Le champ passe par la sérialisation publique : c'est ce qu'en reçoit
        // le navigateur. Si `notice` n'y survivait pas, l'encart n'existerait
        // qu'en local et ce test le dirait.
        field: toPublicField(cadreDemande),
        value,
        locale: "fr",
        onChange: () => {},
      }),
    }),
  );
}

describe("PdfField — encart `notice`", () => {
  it("le champ C47 porte bien un encart, et il traverse la sérialisation publique", () => {
    expect(toPublicField(cadreDemande).notice?.text.fr).toBe(phrase);
  });

  it("ne montre rien tant que la question est sans réponse", () => {
    const html = renderFr("");
    expect(html).not.toContain(dansLeHtml);
    expect(html).not.toContain('role="status"');
    // Le contrôle, lui, est bien rendu : c'est l'encart qui manque, pas le champ.
    expect(html).toContain('id="cadreDemande"');
  });

  it("affiche l'encart dès qu'une réponse est choisie, quelle qu'elle soit", () => {
    for (const option of cadreDemande.options ?? []) {
      const html = renderFr(option.value);
      expect(html, `réponse « ${option.value} »`).toContain(dansLeHtml);
    }
  });

  it("l'encart est bleu (tokens `--glass-info-*`) et annoncé sans couper la parole", () => {
    const html = renderFr("art114");
    // Des TOKENS, pas une couleur en dur : un `bg-blue-50` virerait au blanc
    // sur le fond mauve du front, et n'aurait aucune variante sombre.
    expect(html).toContain("var(--glass-info-surface)");
    expect(html).toContain("var(--glass-info-border)");
    expect(html).toContain("var(--glass-info-ink)");
    // `status` et non `alert` : l'encart naît d'une réponse du citoyen et ne
    // signale aucun problème (cf. FieldNoticeBox).
    expect(html).toContain('role="status"');
    expect(html).not.toContain('role="alert"');
  });
});
