/**
 * GET /api/chomage-ia/sessions/[id]/export
 *
 * Renvoie la conversation complète formatée en Markdown, avec :
 *   - Header méta : titre, date d'export, modèle, nombre de messages.
 *   - Un bloc par message (user / assistant) avec timestamp et stats tokens.
 *   - Une section "Sources citées" en fin si la session a des citations.
 *   - Les marqueurs `[SRC:id]` sont préservés tels quels — un retraitement
 *     possible serait de les remplacer par des `[citation N]`, mais on les
 *     garde pour pouvoir ré-importer / retracer la source d'origine.
 *
 * Le `Content-Disposition: attachment` force le téléchargement avec un nom
 * basé sur le titre de la session (sanitisé pour Windows / Linux / macOS).
 *
 * Auth admin requise.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { getModelShortName } from "@/components/admin/chomage-ia/chat/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Sanitise un titre pour usage comme nom de fichier sur Windows / Linux / macOS.
 * Remplace les caractères interdits par un tiret et limite la longueur.
 */
function sanitizeFilename(title: string): string {
  const cleaned = title
    .normalize("NFKD")
    // Supprime les caractères interdits Windows : <>:"/\|?*
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    // Espaces / tirets multiples → un seul tiret
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned || "conversation";
}

/**
 * Échappe les caractères Markdown qui pourraient casser le rendu si le titre
 * de la session contient `#`, `*`, etc. Utilisé uniquement pour le H1.
 */
function escapeMarkdownTitle(s: string): string {
  return s.replace(/([\\`*_{}\[\]<>])/g, "\\$1");
}

/** Format date FR-BE court : "15/05/2026 14:32". */
function fmtDateTimeFr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const session = await prisma.chatSession.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!session) {
    return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  }

  // Charge les sources citées globalement pour la section dédiée en fin.
  const allCitedIds = new Set<string>();
  for (const m of session.messages) {
    for (const sid of m.citedSourceIds) allCitedIds.add(sid);
  }
  const citedSources =
    allCitedIds.size > 0
      ? await prisma.knowledgeSource.findMany({
          where: { id: { in: [...allCitedIds] } },
          select: {
            id: true,
            title: true,
            kind: true,
            sourceUrl: true,
            summary: true,
          },
        })
      : [];

  // ----- Construction du markdown -----
  const lines: string[] = [];
  const nowFr = fmtDateTimeFr(new Date());
  const modelLabel = getModelShortName(session.preferredModel);

  lines.push(`# ${escapeMarkdownTitle(session.title)}`);
  lines.push("");
  lines.push(`> Exporté le ${nowFr}`);
  lines.push(`> Modèle : ${modelLabel}${session.preferredModel ? ` (\`${session.preferredModel}\`)` : ""}`);
  lines.push(`> Domaine : ${session.domain}`);
  lines.push(
    `> ${session.messages.length} message${session.messages.length > 1 ? "s" : ""}`
  );
  if (session.pinned) lines.push("> Statut : épinglée");
  if (session.archived) lines.push("> Statut : archivée");
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const m of session.messages) {
    const isUser = m.role === "user";
    const header = isUser ? "👤 Vous" : "✨ Claude";
    const modelSuffix =
      !isUser && m.model
        ? ` (${m.model.includes("sonnet") ? "Sonnet 4.5" : m.model.includes("haiku") ? "Haiku 4.5" : m.model})`
        : "";
    const date = fmtDateTimeFr(m.createdAt);
    const stats: string[] = [];
    if (m.tokensOut != null) {
      stats.push(
        m.tokensOut >= 1000
          ? `${(m.tokensOut / 1000).toFixed(1)}K tokens`
          : `${m.tokensOut} tokens`
      );
    }
    const statsSuffix = stats.length > 0 ? ` · ${stats.join(" · ")}` : "";
    lines.push(`## ${header}${modelSuffix} — ${date}${statsSuffix}`);
    lines.push("");
    // Le contenu est inséré tel quel — il est déjà en markdown produit par
    // Claude. Les marqueurs `[SRC:id]` sont conservés pour traçabilité.
    lines.push(m.content);
    lines.push("");
  }

  // Section "Sources citées" si non-vide.
  if (citedSources.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Sources citées");
    lines.push("");
    for (const s of citedSources) {
      const link = s.sourceUrl
        ? `[${s.title}](${s.sourceUrl})`
        : `**${s.title}**`;
      const meta = `\`[SRC:${s.id}]\` · ${s.kind}`;
      lines.push(`- ${link} — ${meta}`);
      if (s.summary && s.summary.trim().length > 0) {
        lines.push(
          `  > ${s.summary.replace(/\n/g, " ").trim().slice(0, 240)}${s.summary.length > 240 ? "…" : ""}`
        );
      }
    }
    lines.push("");
  }

  const md = lines.join("\n");
  const filename = sanitizeFilename(session.title) + ".md";

  return new NextResponse(md, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
