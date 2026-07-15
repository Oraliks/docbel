import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { readSourcePdf } from "@/lib/pdf-forms/storage";
import { fillForm } from "@/lib/pdf-forms/filler";
import { resolveStamps } from "@/lib/pdf-forms/bindings/engine";
import { getRulesForSlug } from "@/lib/pdf-forms/bindings/registry";
import { buildValidator } from "@/lib/pdf-forms/validation";
import { renderFilename } from "@/lib/pdf-forms/filename";
import { sha256Hex, checkRateLimit, getClientIp } from "@/lib/pdf-forms/security";
import { sendToDoccle, isDoccleConfigured } from "@/lib/pdf-forms/integrations/doccle";
import { todayISO } from "@/lib/pdf-forms/system-values";
import { applyServerAutoFields } from "@/lib/pdf-forms/auto-fields";
import { shouldFlattenGeneratedPdf } from "@/lib/pdf-forms/flatten-policy";
import { PdfFormField, FormPayload, Locale, isLocale } from "@/lib/pdf-forms/types";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import { loadDossierState } from "@/lib/bundles/completion";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// POST — génère le PDF rempli. AUCUN stockage (RGPD) :
///   - delivery "download" → stream direct du PDF.
///   - delivery "doccle"   → envoi via Doccle, réponse JSON.
/// Un log d'audit sans PII est enregistré dans tous les cas.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const writeBlock = await ensureWriteAllowed();
  if (writeBlock) return writeBlock;

  const { slug } = await params;
  const ip = getClientIp(req);
  const rl = checkRateLimit(`pdf-generate:${ip}:${slug}`, { windowMs: 60_000, max: 5 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Trop de requêtes, réessayez plus tard" }, { status: 429, headers: json });
  }

  const form = await prisma.pdfForm.findUnique({ where: { slug } });
  if (!form || form.status !== "published") {
    return NextResponse.json({ error: "Formulaire indisponible" }, { status: 404, headers: json });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: json });
  }

  if (body.consent !== true) {
    return NextResponse.json({ error: "Consentement RGPD requis" }, { status: 400, headers: json });
  }

  const lang: Locale = isLocale(body.locale) ? body.locale : (form.defaultLocale as Locale);
  const delivery: "download" | "doccle" | "save" =
    body.delivery === "doccle" ? "doccle" : body.delivery === "save" ? "save" : "download";
  if (delivery === "doccle" && !(form.allowDoccle && isDoccleConfigured())) {
    return NextResponse.json({ error: "Envoi Doccle indisponible" }, { status: 400, headers: json });
  }
  if (delivery === "download" && !form.allowDownload) {
    return NextResponse.json({ error: "Téléchargement désactivé" }, { status: 400, headers: json });
  }

  const bundleRunId = typeof body.bundleRunId === "string" ? body.bundleRunId : null;

  const fields = (form.fields as unknown as PdfFormField[]) || [];

  const incoming = ((body.payload as FormPayload) || {});
  const today = todayISO();

  const validator = buildValidator(fields, lang);
  const result = validator.safeParse(incoming);
  if (!result.success) {
    return NextResponse.json(
      {
        error: "Validation échouée",
        issues: result.error.issues.map((i) => ({ field: i.path[0], message: i.message })),
      },
      { status: 422, headers: json }
    );
  }
  // Dates auto (date de création) + signatures : valeurs imposées par le
  // serveur, appliquées APRÈS la validation. Impératif : `buildValidator`
  // exclut ces champs de son schéma et `z.object` strippe les clés inconnues —
  // les injecter avant `safeParse` (comme avant le 2026-07-11) les faisait
  // disparaître de `result.data`, d'où un PDF sans date ni signature.
  const validated = applyServerAutoFields(fields, result.data as FormPayload, today);

  // Propriété du run (même logique que app/api/documents/bundles/[id]/run/route.ts) :
  // userId de session si connecté, sinon cookie de session anonyme.
  const session0 = await auth.api.getSession({ headers: await headers() });
  const ownerUserId = session0?.user?.id || null;
  const ownerSessionId = req.cookies.get("beldoc-bundle-session")?.value || null;

  // Mode "save" : valide + persiste, ne génère AUCUN PDF. Utilisé quand ce
  // formulaire est rempli à l'intérieur d'un dossier (bundleRunId fourni) —
  // le téléchargement se fait plus tard, groupé, une fois tout complété.
  if (delivery === "save") {
    if (!bundleRunId) {
      return NextResponse.json({ error: "bundleRunId requis pour delivery=save" }, { status: 400, headers: json });
    }
    const before = await loadDossierState(bundleRunId, { userId: ownerUserId, sessionId: ownerSessionId });
    if (!before) {
      return NextResponse.json({ error: "Dossier introuvable" }, { status: 404, headers: json });
    }
    // Lot 3 : la validation fait passer ce formulaire de « brouillon » à
    // « validé » → on purge son entrée dans `draftPayloads` (les brouillons des
    // AUTRES documents du dossier sont préservés) et on oublie l'étape/champ
    // actifs. La reprise fine ne doit plus rouvrir ce document sur une étape.
    const runDraft = await prisma.bundleRun.findUnique({
      where: { id: bundleRunId },
      select: { draftPayloads: true },
    });
    const nextDraft = { ...((runDraft?.draftPayloads as Record<string, unknown>) ?? {}) };
    delete nextDraft[form.id];
    await prisma.bundleRun.update({
      where: { id: bundleRunId },
      data: {
        payloads: { ...before.payloads, [form.id]: validated } as unknown as Prisma.InputJsonValue,
        completedTemplateIds: (before.completedTemplateIds.includes(form.id)
          ? before.completedTemplateIds
          : [...before.completedTemplateIds, form.id]) as unknown as Prisma.InputJsonValue,
        draftPayloads:
          Object.keys(nextDraft).length > 0 ? (nextDraft as Prisma.InputJsonValue) : Prisma.DbNull,
        lastStepId: null,
        lastActiveField: null,
      },
    });
    const after = await loadDossierState(bundleRunId, { userId: ownerUserId, sessionId: ownerSessionId });
    const beforeSlugs = new Set(before.missing.map((m) => m.slug));
    const newlyTriggered = (after?.missing ?? []).filter((m) => !beforeSlugs.has(m.slug) && m.slug !== form.slug);
    // Complétion : dès que TOUS les documents requis sont remplis, on horodate
    // `completedAt` (idempotent via `updateMany` sur completedAt:null → posé une
    // seule fois, sans course). Alimente les métriques de complétion du cockpit.
    // On NE touche PAS `status` : un dossier complété doit rester éditable (le
    // garde `status === "in_progress"` du chemin download autorise encore
    // l'écriture des payloads).
    if (after?.allRequiredDone) {
      await prisma.bundleRun.updateMany({
        where: { id: bundleRunId, completedAt: null },
        data: { completedAt: new Date() },
      });
    }
    await logSubmission(form.id, form.version, lang, validated, "save", true, ip);
    // `missing` (ordonné par `order`, cf. deriveMissingDocs) + `allRequiredDone`
    // alimentent l'écran de continuation in-line (§11.3) : le runner propose de
    // continuer avec `missing[0]` sans repasser par la liste des documents.
    // Réutilise l'état `after` déjà chargé — aucune requête supplémentaire.
    return NextResponse.json(
      {
        ok: true,
        saved: true,
        newlyTriggered,
        missing: after?.missing ?? [],
        allRequiredDone: after?.allRequiredDone ?? false,
      },
      { headers: json },
    );
  }

  // Verrou dossier entier : un téléchargement (download/doccle) demandé
  // depuis un dossier (bundleRunId fourni) est refusé tant que TOUS les
  // documents requis — de base ET déclenchés par les réponses données,
  // dans N'IMPORTE quel formulaire du dossier — ne sont pas complétés.
  if (bundleRunId) {
    const state = await loadDossierState(bundleRunId, { userId: ownerUserId, sessionId: ownerSessionId });
    if (state && !state.allRequiredDone) {
      return NextResponse.json(
        { error: "dossier_incomplete", missing: state.missing },
        { status: 409, headers: json },
      );
    }
  }

  const source = await readSourcePdf(form.sourceStoragePath, form.sourceFileName);
  if (!source) {
    return NextResponse.json({ error: "PDF source introuvable" }, { status: 500, headers: json });
  }

  // technicalSchema sert au filler pour les champs `signature` : il y trouve
  // le rectangle + l'index de page de chaque widget à habiller d'une image.
  const technicalSchema =
    (form.technicalSchema as unknown as import("@/lib/pdf-forms/types").AcroFieldRaw[]) || [];

  // Bindings serveur (Phase 1 du plan pdf-bindings-canonical-ux) : le
  // registry par slug produit une Map widget→valeur appliquée par-dessus
  // le mapping schéma. Slug inconnu → tableau vide → aucun stamp
  // additionnel (safe par défaut). Les 6 transforms client-side
  // historiques restent temporairement actifs côté runner : les règles
  // sont IDEMPOTENTES par-dessus (mêmes valeurs), retrait en Phase 7.
  const extraStamps = resolveStamps(validated, getRulesForSlug(form.slug));

  let pdfBytes: Buffer;
  try {
    pdfBytes = (
      await fillForm(source, fields, validated, {
        flatten: shouldFlattenGeneratedPdf(form.slug),
        technicalSchema,
        extraStamps,
      })
    ).bytes;
  } catch (err) {
    console.error("pdf-forms generate error:", err);
    await logSubmission(form.id, form.version, lang, validated, delivery, false, ip);
    return NextResponse.json({ error: "Échec de génération" }, { status: 500, headers: json });
  }

  // Si le PDF est ouvert dans un dossier (bundle), on persiste le payload
  // validé dans le run pour que les PDFs suivants puissent récupérer les
  // valeurs partagées (NISS, adresse, etc.). Clé = pdfFormId (cuid unique,
  // cohabite avec les templateId de l'ancien module dans le même dict).
  if (bundleRunId) {
    try {
      const run = await prisma.bundleRun.findUnique({ where: { id: bundleRunId } });
      // Propriété du run : ne JAMAIS écrire dans le dossier d'un autre citoyen.
      // Sans ce garde, une requête `download` portant un bundleRunId ÉTRANGER
      // (deviné via l'URL `?bundleRun=`) injecterait le payload de l'appelant
      // dans le run de la victime (écriture cross-tenant). Même logique de
      // propriété que loadDossierState.
      const owns = run
        ? ownerUserId
          ? run.userId === ownerUserId
          : ownerSessionId
            ? run.sessionId === ownerSessionId
            : false
        : false;
      if (run && run.status === "in_progress" && owns) {
        const currentPayloads = (run.payloads as Record<string, unknown>) || {};
        const currentCompleted = (run.completedTemplateIds as string[]) || [];
        const newPayloads = { ...currentPayloads, [form.id]: validated };
        const newCompleted = currentCompleted.includes(form.id)
          ? currentCompleted
          : [...currentCompleted, form.id];
        await prisma.bundleRun.update({
          where: { id: bundleRunId },
          data: {
            payloads: newPayloads as unknown as Prisma.InputJsonValue,
            completedTemplateIds: newCompleted as unknown as Prisma.InputJsonValue,
          },
        });
        // Complétion : le téléchargement est une action terminale du dossier.
        // Comme le chemin "save" (~l.126), si TOUS les documents requis sont
        // remplis on horodate `completedAt` (idempotent via updateMany sur
        // completedAt:null → posé une seule fois, sans course). Sans cela, seul
        // le chemin "save" alimentait la métrique de complétion et un dossier
        // livré par download restait « jamais complété » (=0). On reste dans le
        // garde de propriété (`owns`) : jamais horodater un run étranger.
        const after = await loadDossierState(bundleRunId, {
          userId: ownerUserId,
          sessionId: ownerSessionId,
        });
        if (after?.allRequiredDone) {
          await prisma.bundleRun.updateMany({
            where: { id: bundleRunId, completedAt: null },
            data: { completedAt: new Date() },
          });
        }
      }
    } catch (err) {
      // Non-bloquant : la génération du PDF a déjà réussi ; on log juste.
      console.error("[pdf-generate] BundleRun update failed:", err);
    }
  }

  const filename = renderFilename(form.slug, validated);

  // Livraison Doccle
  if (delivery === "doccle") {
    const recipient = (body.doccleRecipient as { reference?: string; email?: string }) || {};
    if (!recipient.reference) {
      return NextResponse.json({ error: "Destinataire Doccle requis" }, { status: 400, headers: json });
    }
    try {
      const res = await sendToDoccle({
        recipient: { reference: recipient.reference, email: recipient.email },
        filename,
        pdf: pdfBytes,
        title: form.title,
        issuer: form.issuer || undefined,
      });
      await logSubmission(form.id, form.version, lang, validated, "doccle", true, ip);
      return NextResponse.json({ ok: true, delivery: "doccle", documentId: res.documentId, status: res.status }, { headers: json });
    } catch (err) {
      console.error("Doccle send error:", err);
      await logSubmission(form.id, form.version, lang, validated, "doccle", false, ip);
      return NextResponse.json({ error: "Échec de l'envoi via Doccle" }, { status: 502, headers: json });
    }
  }

  // Livraison download (stream, zéro stockage)
  await logSubmission(form.id, form.version, lang, validated, "download", true, ip);
  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

async function logSubmission(
  formId: string,
  formVersion: number,
  locale: string,
  payload: FormPayload,
  delivery: string,
  success: boolean,
  ip: string
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    await prisma.pdfFormSubmissionLog.create({
      data: {
        formId,
        formVersion,
        locale,
        payloadHash: sha256Hex(JSON.stringify(payload)),
        delivery,
        success,
        ipHash: sha256Hex(ip),
        userId: session?.user?.id || null,
      },
    });
  } catch (err) {
    console.error("logSubmission failed (non-blocking):", err);
  }
}
