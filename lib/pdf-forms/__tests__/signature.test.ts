import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  resolveSignerName,
  signerNameFromSignatureField,
  buildSignatureBlock,
  signatureTimestamp,
  SIGNATURE_CONFIRMEE,
} from "../signature";
import { applyC1AImprovements } from "../seed/c1a-fields";
import { applyServerAutoFields } from "../auto-fields";
import { fillForm } from "../filler";
import type { AcroFieldRaw, FormPayload, PdfFormField } from "../types";

describe("resolveSignerName", () => {
  it("utilise un champ fullname en priorité", () => {
    const fields = [{ id: "name", type: "fullname", nameOrder: "first-last" as const }];
    const name = resolveSignerName(fields, { name: { first: "Jean", last: "Dupont" } });
    expect(name).toBe("Jean Dupont");
  });

  it("respecte l'ordre nameOrder du fullname", () => {
    const fields = [{ id: "name", type: "fullname", nameOrder: "last-first" as const }];
    expect(resolveSignerName(fields, { name: { first: "Jean", last: "Dupont" } })).toBe("Dupont Jean");
  });

  it("compose prénom + nom via prefillFrom", () => {
    const fields = [
      { id: "fn", type: "text", prefillFrom: "profile.firstName" },
      { id: "ln", type: "text", prefillFrom: "profile.lastName" },
    ];
    expect(resolveSignerName(fields, { fn: "Cecilia", ln: "Demo" })).toBe("Cecilia Demo");
  });

  it("compose prénom + nom via les clés canoniques", () => {
    // La désignation la plus explicite du déclarant, et la seule qui ne puisse
    // pas viser un tiers : le vocabulaire canonique ne décrit que lui.
    const fields = [
      { id: "a", type: "text", canonicalKey: "identity.prenom" },
      { id: "b", type: "text", canonicalKey: "identity.nom" },
    ];
    expect(resolveSignerName(fields, { a: "Cecilia", b: "Demo" })).toBe("Cecilia Demo");
  });

  it("retombe sur l'heuristique libellé/id (Prénom / Nom)", () => {
    // Formulaire ancien, schéma inféré sans aucun marqueur : deviner est le
    // seul recours, et il reste autorisé.
    const fields = [
      { id: "prenom", type: "text", label: { fr: "Prénom" } },
      { id: "nom", type: "text", label: { fr: "Nom" } },
    ];
    expect(resolveSignerName(fields, { prenom: "Cecilia", nom: "Demo" })).toBe("Cecilia Demo");
  });

  it("renvoie '' si aucun nom exploitable", () => {
    const fields = [{ id: "x", type: "text", label: { fr: "Remarque" } }];
    expect(resolveSignerName(fields, { x: "blabla" })).toBe("");
  });
});

describe("resolveSignerName — jamais le nom d'un tiers", () => {
  it("n'appose PAS le nom de l'indépendant aidé sur le C1A", () => {
    // Vérifié sur le schéma réel le 2026-07-29 : avec un `nomEtPrenom` vide,
    // l'heuristique de libellé attrapait « 2. Nom de l'indépendant que tu
    // aides » et renvoyait « Vandenberghe ». Le filler apposait alors « Signé
    // numériquement par Vandenberghe » sur la déclaration d'un autre citoyen.
    const c1a = applyC1AImprovements([]);
    expect(
      resolveSignerName(c1a, {
        nomEtPrenom: { first: "", last: "" },
        aideIndependant: "oui",
        independantNom: "Vandenberghe",
        employeurNom: "SPRL Machin",
      }),
    ).toBe("");
  });

  it("appose bien le nom du déclarant dès qu'il est là", () => {
    const c1a = applyC1AImprovements([]);
    expect(
      resolveSignerName(c1a, {
        nomEtPrenom: { first: "Jean", last: "Dupont" },
        independantNom: "Vandenberghe",
      }),
      // `nameOrder: "last-first"` — l'ordre imposé par le libellé imprimé.
    ).toBe("Dupont Jean");
  });

  it("un schéma qui désigne sa source ne devine plus jamais", () => {
    // Le garde est général : il ne connaît ni le C1A ni `independantNom`.
    const fields = [
      { id: "moi", type: "fullname" },
      { id: "nomDuBailleur", type: "text", label: { fr: "Nom du bailleur" } },
    ];
    expect(resolveSignerName(fields, { nomDuBailleur: "Peeters" })).toBe("");
  });
});

describe("bloc de signature apposé sur le PDF", () => {
  /// PDF minimal : une case de signature seule, avec sa géométrie.
  async function pdfAvecSignature(): Promise<{ source: Buffer; technicalSchema: AcroFieldRaw[] }> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 400]);
    doc.getForm().createTextField("sig").addToPage(page, { x: 20, y: 100, width: 220, height: 40 });
    return {
      source: Buffer.from(await doc.save()),
      technicalSchema: [
        { pdfFieldName: "sig", acroType: "text", page: 0, rect: [20, 100, 220, 40] },
      ],
    };
  }

  const CHAMPS = [
    { id: "sig", pdfFieldName: "sig", type: "signature", required: true, label: { fr: "Signature" } },
    // `pdfFieldName` vide : ce champ ne vise aucun widget, il ne sert qu'à
    // porter (ou non) le nom du déclarant.
    { id: "moi", pdfFieldName: "", type: "fullname", required: true, label: { fr: "Nom" } },
  ] as unknown as PdfFormField[];

  /// Taille du PDF produit. Le bloc de signature est DESSINÉ sur la page et
  /// embarque une police : sa présence se lit à la taille, comme dans
  /// `filler-drawat.test.ts`.
  async function tailleRendue(payload: FormPayload): Promise<number> {
    const { source, technicalSchema } = await pdfAvecSignature();
    const { bytes } = await fillForm(source, CHAMPS, payload, { flatten: false, technicalSchema });
    return bytes.length;
  }

  it("la sentinelle de confirmation n'est pas un nom de signataire", () => {
    // C'est la décision que prenait le repli du filler : « confirmed » y était
    // pris pour un nom dès que la résolution du signataire échouait, et le
    // document officiel partait « Signé numériquement par confirmed ».
    expect(signerNameFromSignatureField(SIGNATURE_CONFIRMEE)).toBe("");
    expect(signerNameFromSignatureField("  confirmed  ")).toBe("");
    expect(signerNameFromSignatureField("")).toBe("");
    expect(signerNameFromSignatureField(true)).toBe("");
    // Le repli n'est pas supprimé pour autant : un nom TAPÉ reste valable.
    expect(signerNameFromSignatureField("  Jean Dupont ")).toBe("Jean Dupont");
  });

  it("c'est bien cette valeur-là que le serveur dépose", () => {
    // Épingle le couplage avec `applyServerAutoFields` : si l'un des deux
    // change de sentinelle, ce test tombe au lieu du PDF.
    const champs = [{ id: "sig", type: "signature", label: { fr: "Signature" } }];
    const pose = applyServerAutoFields(champs, {} as Record<string, unknown>, "2026-07-29");
    expect(pose.sig).toBe(SIGNATURE_CONFIRMEE);
  });

  it("le bloc n'est dessiné QUE si un nom est résolu", async () => {
    const rien = await tailleRendue({ sig: "", moi: { first: "", last: "" } });
    const sansNom = await tailleRendue({ sig: SIGNATURE_CONFIRMEE, moi: { first: "", last: "" } });
    const avecNom = await tailleRendue({
      sig: SIGNATURE_CONFIRMEE,
      moi: { first: "Jean", last: "Dupont" },
    });
    // Case confirmée SANS nom : le filler vide le widget (d'où un écart de
    // quelques centaines d'octets avec le tout-vide) mais ne dessine AUCUN
    // bloc. Avec un nom, le bloc et sa police cursive pèsent des kilo-octets :
    // les deux cas ne peuvent pas être confondus.
    expect(sansNom).toBeLessThan(rien + 1000);
    expect(avecNom).toBeGreaterThan(sansNom + 2000);
  });
});

describe("signatureTimestamp / buildSignatureBlock", () => {
  it("horodatage au format AAAA.MM.JJ HH:mm:ss", () => {
    expect(signatureTimestamp(new Date("2026-05-31T12:30:00Z"))).toMatch(/^\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2}$/);
  });
  it("compose les 3 lignes du bloc", () => {
    const b = buildSignatureBlock("Jean Dupont", new Date("2026-05-31T12:30:00Z"));
    expect(b.name).toBe("Jean Dupont");
    expect(b.by).toBe("Signé numériquement par Jean Dupont");
    expect(b.date).toMatch(/^Date : \d{4}\.\d{2}\.\d{2}/);
  });
});
