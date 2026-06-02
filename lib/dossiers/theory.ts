// Rendu des sections théoriques d'un dossier.
//
// Une section théorique est un Markdown rédigé en interne (paraphrase, jamais
// de copie verbatim d'une source non publique). Il peut contenir des
// "bindings" sous la forme `{{ motifs }}` qui sont remplacés au rendu par
// les listes extraites de la structure du dossier — pour que la théorie
// reste automatiquement synchro avec le code.

import type {
  DossierDefinition,
  DossierTheorySection,
  TheoryAudience,
  TheoryBinding,
} from "./types";

/// Construit le bloc Markdown correspondant à un binding donné, à partir de
/// la structure actuelle du dossier.
function renderBinding(binding: TheoryBinding, def: DossierDefinition): string {
  switch (binding) {
    case "motifs":
      return def.types.map((t) => `- ${t}`).join("\n");

    case "documents": {
      const docs = def.documents.map((d) => {
        const cond = d.includeWhen ? " *(inclus sous conditions)*" : "";
        return `- **${d.title}** — ${d.issuer}${cond}`;
      });
      return docs.join("\n");
    }

    case "questions": {
      const qs = def.questions.map((q) => {
        const opts = q.options ? ` *(${q.options.map((o) => o.value).join(" / ")})*` : "";
        const visible = q.visibleWhen ? " *(conditionnelle)*" : "";
        const labelFr = q.label.fr ?? q.id;
        return `- **${labelFr}**${opts}${visible}`;
      });
      return qs.join("\n");
    }

    case "qui-est-concerne": {
      if (!def.whoConcerned) return "_(matrice non définie)_";
      const lines: string[] = [];
      lines.push("| Motif | Ouvrier | Employé | Intérimaire |");
      lines.push("| --- | :---: | :---: | :---: |");
      for (const motif of def.types) {
        const allowed = def.whoConcerned[motif] ?? [];
        const cell = (s: string) => (allowed.includes(s as "ouvrier") ? "✓" : "—");
        lines.push(`| ${motif} | ${cell("ouvrier")} | ${cell("employe")} | ${cell("interimaire")} |`);
      }
      return lines.join("\n");
    }

    case "delais":
      // Pour l'instant pas de structure typée pour les délais → on laisse vide.
      // Quand on ajoutera un champ `delais` typé au DossierDefinition, on le
      // rendra ici sous forme de tableau.
      return "_(à compléter — structure dédiée à venir)_";

    case "nature-da":
      if (!def.natureDA) return "_(non défini)_";
      return [
        "La nature de DA est calculée automatiquement à partir des réponses.",
        "Elle ne fait pas l'objet d'une question.",
      ].join("\n\n");
  }
}

/// Interpole les bindings dans le corps Markdown d'une section.
export function interpolateTheoryBody(
  section: DossierTheorySection,
  def: DossierDefinition
): string {
  let out = section.body;
  for (const b of section.bindings ?? []) {
    const block = renderBinding(b, def);
    // On accepte "{{ motifs }}" et "{{motifs}}" (espaces variables).
    const re = new RegExp(`\\{\\{\\s*${escapeRegex(b)}\\s*\\}\\}`, "g");
    out = out.replace(re, block);
  }
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/// Filtre les sections théoriques selon l'audience du lecteur.
export function visibleTheorySections(
  def: DossierDefinition,
  audience: TheoryAudience
): DossierTheorySection[] {
  if (!def.theory) return [];
  return def.theory.filter((s) => s.audience.includes(audience));
}
