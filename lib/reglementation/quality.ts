/**
 * Audit de qualité du corpus RioLex, calculé À LA VOLÉE depuis les données déjà
 * en base (aucune ré-importation, aucune écriture). Signale à l'admin les
 * articles douteux pour prioriser les recompletions — sans qu'un conseiller
 * s'appuie au guichet sur un texte amputé sans le savoir.
 *
 * 100 % pur, testé unitairement.
 */

export interface AuditRow {
  riolexId: string;
  loi: string;
  articleNumber: string;
  title: string;
  /** Extrait du contenu (peut être tronqué pour l'audit). */
  content: string;
  /** Longueur réelle du contenu complet. */
  contentLength: number;
  version: string | null;
  datePublication: string | null;
  abroge: boolean;
  isComment: boolean;
}

export type IssueKind =
  | "empty-content"
  | "short-content"
  | "truncated-comment"
  | "placeholder-body"
  | "version-artefact";

export interface Issue {
  riolexId: string;
  loi: string;
  articleNumber: string;
  title: string;
  kind: IssueKind;
  detail: string;
}

export interface AuditResult {
  total: number;
  comments: number;
  issues: Issue[];
  byKind: Record<IssueKind, number>;
}

const PLACEHOLDER_ONLY = /^(?:\s*\{\d+\}\s*❌?\s*)+$/;
const TRUNCATION = /\[(?:\.\.\.|…)\]/;

export function auditCorpus(rows: AuditRow[]): AuditResult {
  const issues: Issue[] = [];
  const byKind: Record<IssueKind, number> = {
    "empty-content": 0,
    "short-content": 0,
    "truncated-comment": 0,
    "placeholder-body": 0,
    "version-artefact": 0,
  };

  const push = (r: AuditRow, kind: IssueKind, detail: string) => {
    issues.push({
      riolexId: r.riolexId,
      loi: r.loi,
      articleNumber: r.articleNumber,
      title: r.title,
      kind,
      detail,
    });
    byKind[kind] += 1;
  };

  let comments = 0;
  for (const r of rows) {
    if (r.isComment) comments += 1;
    const body = (r.content ?? "").trim();

    if (r.contentLength === 0 || body.length === 0) {
      push(r, "empty-content", "Contenu vide.");
      continue;
    }
    if (r.isComment && TRUNCATION.test(r.content)) {
      push(r, "truncated-comment", "Commentaire potentiellement tronqué ([…]).");
    }
    if (!r.isComment && !r.abroge && PLACEHOLDER_ONLY.test(body)) {
      push(
        r,
        "placeholder-body",
        "Corps composé uniquement de marqueurs supprimés, mais non marqué abrogé.",
      );
    }
    if (!r.isComment && !r.abroge && r.contentLength < 40) {
      push(r, "short-content", `Contenu très court (${r.contentLength} caractères).`);
    }
    if (r.version && r.version === r.articleNumber) {
      push(r, "version-artefact", `Champ « version » = n° d'article (« ${r.version} »).`);
    }
  }

  return { total: rows.length, comments, issues, byKind };
}
