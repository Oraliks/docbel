import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fillForm } from "../filler";
import type { PdfFormField } from "../types";

/// Le remplissage ne doit plus mentir sur ce qu'il a écrit.
///
/// `fillForm` est best-effort par conception : il ne lève jamais parce qu'un
/// widget manque, sinon un détail de template priverait le citoyen de son
/// document. Mais l'échec était AVALÉ, et une case restait blanche sur un
/// formulaire officiel sans que rien ne le signale. Deux modes de panne sont
/// couverts ici, tous deux constatés sur les vrais PDF.

const C1 = join(process.cwd(), "private", "pdfs", "C1_FR.pdf");
const c1 = existsSync(C1) ? readFileSync(C1) : null;
const skip = c1 ? it : it.skip;

function champ(id: string, widget: string): PdfFormField {
  return { id, pdfFieldName: widget, type: "text", required: false, label: { fr: id } };
}

describe("fillForm — diagnostics", () => {
  skip("ne signale rien quand tout est écrit", async () => {
    const { diagnostics } = await fillForm(c1!, [champ("nom", "Nom")], { nom: "Dupont" }, { flatten: false });
    expect(diagnostics).toEqual([]);
  });

  skip("signale un widget introuvable au lieu de laisser la case blanche", async () => {
    // Le mode de panne réel : l'ONEM republie le formulaire en renommant un
    // widget, le schéma pointe dans le vide, et la génération n'en dit rien.
    const { diagnostics } = await fillForm(
      c1!,
      [champ("nom", "Nom_qui_nexiste_plus")],
      { nom: "Dupont" },
      { flatten: false }
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      fieldId: "nom",
      widget: "Nom_qui_nexiste_plus",
      kind: "widget-introuvable",
    });
  });

  skip("signale les caractères qu'AUCUNE police embarquée ne sait dessiner", async () => {
    // Le plus pernicieux : fontkit ne lève pas sur un glyphe absent, il le
    // mappe sur le glyphe 0 — dont le contour est VIDE. Le texte s'écrit « en
    // rien », et après aplatissement la case part blanche avec
    // `unicodeFont === true` pour dire que tout va bien.
    //
    // Depuis l'ajout de Noto Sans en repli, le cyrillique et le grec sont
    // rendus (cf. filler-font-fallback) — le diagnostic ne concerne plus que
    // les écritures réellement non couvertes : arabe, hébreu, chinois.
    const { diagnostics, unicodeFont } = await fillForm(
      c1!,
      [champ("nom", "Nom")],
      { nom: "李伟" },
      { flatten: false }
    );

    expect(unicodeFont).toBe(true); // la police EST embarquée — c'est le piège
    const manquants = diagnostics.filter((d) => d.kind === "caracteres-non-rendus");
    expect(manquants).toHaveLength(1);
    expect(manquants[0].fieldId).toBe("nom");
    expect(manquants[0].detail).toBe("李伟");
  });

  skip("laisse passer ce qui est couvert, latin étendu comme cyrillique", async () => {
    // Contrôle négatif : sans lui, une sonde trop stricte signalerait tous les
    // noms belges accentués et le signal deviendrait inutile.
    const { diagnostics } = await fillForm(
      c1!,
      [champ("nom", "Nom"), champ("pr_nom", "Prenom")],
      { nom: "Lemaître-Ștefănescu", pr_nom: "Владимиров" },
      { flatten: false }
    );
    expect(diagnostics).toEqual([]);
  });
});
