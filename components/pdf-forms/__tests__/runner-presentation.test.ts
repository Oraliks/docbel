import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/fr.json";
import { PdfField } from "../pdf-field";
import { AutoSaveNotice } from "../auto-save-notice";
import { Checkbox } from "@/components/ui/checkbox";
import { ReadOnlyFields } from "../compact-accordion-section";
import { SubmitFooter } from "../submit-footer";
import { toPublicField } from "@/lib/pdf-forms/public-serializer";

function render(children: ReactNode) {
  // Le provider exige children dans ses props pour la surcharge TypeScript.
  // eslint-disable-next-line react/no-children-prop
  return renderToStaticMarkup(createElement(NextIntlClientProvider, {
    locale: "fr", messages, children,
  }));
}

const choice = toPublicField({
  id: "choice", pdfFieldName: "", type: "radio", label: { fr: "Votre choix" }, required: true,
  options: ["a", "b", "c"].map((value) => ({ value, label: { fr: value } })),
});

function Footer({ bundleRunId, hasSignature = false }: { bundleRunId?: string; hasSignature?: boolean }) {
  const t = useTranslations("public.dossier");
  return createElement(SubmitFooter, {
    t, variant: "confortable", bundleRunId,
    serverSaved: false, lastSavedAt: null, submitting: false,
    resetForm: () => {}, canGoPrevious: true, onPrevious: () => {},
    allowDownload: true, allowDoccle: false, delivery: "download",
    setDelivery: () => {}, doccleRef: "", setDoccleRef: () => {},
    hasSignature, signerName: hasSignature ? "Nom synthétique" : "", invalidFields: [],
    onJumpToInvalidField: () => {}, consent: false, onConsentChange: () => {},
    consentError: false, invalidSummary: null, consentCheckbox: null,
  });
}

describe("Présentation du runner public", () => {
  it("rend toutes les options natives sans déclencher une réponse ni une avance", () => {
    const change = vi.fn();
    const html = render(createElement(PdfField, { field: choice, value: "b", locale: "fr", onChange: change }));
    expect(html.match(/type="radio"/g)).toHaveLength(3);
    expect(html.match(/checked=""/g)).toHaveLength(1);
    expect(html).toContain('value="b"');
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-labelledby="choice-label"');
    expect(change).not.toHaveBeenCalled();
  });

  it("associe l'erreur visible au groupe et aux contrôles", () => {
    const html = render(createElement(PdfField, { field: choice, value: "", error: "Choisissez une réponse", locale: "fr", onChange: () => {} }));
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="choice-error"');
    expect(html).toContain('id="choice-error"');
    expect(html).toContain("Choisissez une réponse");
  });

  it("n'annonce aucun enregistrement sans sauvegarde confirmée", () => {
    const html = render(createElement(AutoSaveNotice, { serverSaved: true, lastSavedAt: null, isPartOfBundle: false }));
    expect(html).toContain(messages.public.design.ephemeralTitle);
    expect(html).not.toContain("enregistrées automatiquement");
  });

  it("une ancienne démarche ne propose aucune soumission mais garde le retour", () => {
    const html = render(createElement(Footer, { bundleRunId: "synthetic-old-run" }));
    expect(html).toContain(messages.public.design.oldReadOnly);
    expect(html).not.toContain('type="submit"');
    expect(html).toContain(messages.public.dossier.previous);
  });

  it("un formulaire autonome conserve sa génération et sa distinction avec un envoi", () => {
    const html = render(createElement(Footer, {}));
    expect(html).toContain('type="submit"');
    expect(html).toContain(messages.public.dossier.runnerSubmitGenerate);
    expect(html).not.toContain(messages.public.dossier.runnerSubmitSignAndGenerate);
    expect(html).toContain(messages.public.design.preparedNotSent);
  });
  it("conserve la signature lorsque le schéma en prévoit une", () => {
    const html = render(createElement(Footer, { hasSignature: true }));
    expect(html).toContain(messages.public.dossier.runnerSubmitSignAndGenerate);
    expect(html).toContain("Nom synthétique");
  });
});

describe("Anciennes réponses en lecture seule", () => {
  it("désactive les champs natifs et Base UI, sans désactiver la navigation voisine", () => {
    const html = render(createElement("div", null,
      // eslint-disable-next-line react/no-children-prop
      createElement(ReadOnlyFields, { readOnly: true, children: createElement("div", null,
        createElement("input", { defaultValue: "Réponse conservée" }),
        createElement(Checkbox, { checked: true, onCheckedChange: () => {} }),
      ) }),
      createElement("button", { type: "button" }, "Étape suivante"),
    ));
    expect(html).toMatch(/<fieldset[^>]*disabled=""/);
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("Réponse conservée");
    expect(html).toContain('<button type="button">Étape suivante</button>');
  });
});
