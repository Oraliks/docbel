import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { ensureWriteAllowed } from "@/lib/admin/readonly-guard";
import { deleteSourcePdf } from "@/lib/pdf-forms/storage";
import { AcroFieldRaw, isLocale, Locale, PdfFormField, PdfFormTrigger } from "@/lib/pdf-forms/types";
import { sanitizeFields } from "@/lib/pdf-forms/sanitize-fields";
import { parseTriggers } from "@/lib/pdf-forms/triggers";
import { isStaleWrite, STALE_WRITE_CODE } from "@/lib/pdf-forms/concurrency";
import { SEEDED_SLUGS } from "@/lib/pdf-forms/seed/apply-c1-improvements-core";
import { isSeedManagedEditAttempt, SEED_MANAGED_LOCK_ERROR } from "@/lib/pdf-forms/seed-lock";
import { checkPublishable, hasBlockingIssues } from "@/lib/pdf-forms/publish-checks";
import { getRulesForSlug } from "@/lib/pdf-forms/bindings/registry";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// GET — détail complet d'un formulaire (admin).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const form = await prisma.pdfForm.findUnique({ where: { id } });
  if (!form) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: json });
  // seedManaged (S5) : pilote la bannière + le verrouillage des onglets
  // Champs/Déclencheurs côté admin (décision n°2, aucune édition des 8
  // formulaires ONEM semés — le sync les écrase de toute façon).
  return NextResponse.json(
    { ...form, seedManaged: SEEDED_SLUGS.includes(form.slug) },
    { headers: json }
  );
}

/// PATCH — édite les métadonnées et/ou le schéma enrichi.
/// Tout changement de `fields` crée une révision et incrémente la version.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const writeBlock = await ensureWriteAllowed();
  if (writeBlock) return writeBlock;

  const { id } = await params;
  const existing = await prisma.pdfForm.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: json });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: json });
  }

  // --- Verrou optimiste (optimistic concurrency) ---
  // Le client renvoie `expectedUpdatedAt` = le `updatedAt` du form tel qu'il l'a
  // chargé. S'il diffère de la ligne en base, une autre session a écrit entre-temps
  // → 409 (au lieu d'écraser silencieusement). Vérifié AVANT toute écriture pour ne
  // pas créer de révision orpheline. Rétrocompat : précondition absente = pas de
  // verrou (comportement historique conservé). Le `where` composé de l'update final
  // ferme la fenêtre TOCTOU restante (entre ce findUnique et l'update).
  const expectedUpdatedAt =
    typeof body.expectedUpdatedAt === "string" ? body.expectedUpdatedAt : undefined;
  if (isStaleWrite(expectedUpdatedAt, existing.updatedAt.getTime())) {
    return staleWriteResponse(existing.updatedAt);
  }

  // Formulaires gérés par le seed (S5, décision n°2) : le sync écrase
  // `fields`/`triggers` de toute façon (apply-c1-improvements-core.ts) —
  // l'admin ne doit plus pouvoir les éditer ici. Les autres clés
  // (Paramètres, Publication…) restent acceptées, y compris pour ces 8
  // slugs. Comparaison APRÈS sanitisation (isSeedManagedEditAttempt) : un
  // save qui renvoie fields/triggers inchangés — le cas normal du bouton
  // « Enregistrer » — n'est pas bloqué.
  if (
    isSeedManagedEditAttempt({
      seedManaged: SEEDED_SLUGS.includes(existing.slug),
      existingFields: (existing.fields as unknown as PdfFormField[]) || [],
      existingTriggers: (existing.triggers as unknown as PdfFormTrigger[]) || [],
      bodyFields: body.fields,
      bodyTriggers: body.triggers,
    })
  ) {
    return NextResponse.json(SEED_MANAGED_LOCK_ERROR, { status: 409, headers: json });
  }

  const data: Prisma.PdfFormUpdateInput = {};
  if (typeof body.title === "string") data.title = body.title.trim();
  if (typeof body.description === "string" || body.description === null) data.description = (body.description as string) ?? null;
  if (typeof body.issuer === "string" || body.issuer === null) data.issuer = (body.issuer as string) ?? null;
  if (typeof body.organismeId === "string" || body.organismeId === null) {
    // Connect / disconnect explicite (Prisma typing pour FK nullable).
    data.organisme =
      body.organismeId === null || body.organismeId === ""
        ? { disconnect: true }
        : { connect: { id: body.organismeId as string } };
  }
  if (typeof body.allowDownload === "boolean") data.allowDownload = body.allowDownload;
  if (typeof body.allowDoccle === "boolean") data.allowDoccle = body.allowDoccle;
  if (typeof body.allowItsme === "boolean") data.allowItsme = body.allowItsme;
  if (typeof body.publicPath === "string" || body.publicPath === null) {
    // Normalise : trim, lowercase, retire les slashes de bord. Vide = null
    // (pas d'URL publique dédiée). L'unicité est appliquée par l'index DB.
    const raw = typeof body.publicPath === "string"
      ? body.publicPath.trim().toLowerCase().replace(/^\/+|\/+$/g, "")
      : "";
    data.publicPath = raw ? raw : null;
  }
  if (typeof body.active === "boolean") data.active = body.active;
  if (typeof body.disabledMessage === "string" || body.disabledMessage === null) {
    data.disabledMessage = (body.disabledMessage as string | null) ?? null;
  }
  if (body.status === "draft" || body.status === "archived") data.status = body.status;
  if (typeof body.defaultLocale === "string" && isLocale(body.defaultLocale)) data.defaultLocale = body.defaultLocale;
  if (Array.isArray(body.locales)) {
    const locs = (body.locales as unknown[]).filter(isLocale) as Locale[];
    data.locales = Array.from(new Set(["fr", ...locs])) as unknown as Prisma.InputJsonValue;
  }
  if (Array.isArray(body.triggers)) {
    // Parse + sanitise via parseTriggers (drop des éléments mal formés).
    data.triggers = parseTriggers(body.triggers) as unknown as Prisma.InputJsonValue;
  }
  if (Array.isArray(body.testFixtures)) {
    // Parse + normalisation via parseTestFixtures (drop des elements mal
    // formes, no-op sur les entrees valides). Cf. lib/pdf-forms/fixtures.ts.
    const now = new Date().toISOString();
    const cleaned = (await import("@/lib/pdf-forms/fixtures")).parseTestFixtures(body.testFixtures);
    const stamped = cleaned.map((f) => ({
      ...f,
      createdAt: f.createdAt ?? now,
      updatedAt: now,
    }));
    data.testFixtures = stamped as unknown as Prisma.InputJsonValue;
  }

  let createRevision = false;
  if (Array.isArray(body.fields)) {
    const clean = sanitizeFields(body.fields);
    const old = (existing.fields as unknown as PdfFormField[]) || [];
    if (JSON.stringify(old) !== JSON.stringify(clean)) {
      createRevision = true;
      data.fields = clean as unknown as Prisma.InputJsonValue;
      data.version = existing.version + 1;

      // Formulaire PUBLIÉ dont les champs changent réellement : même
      // vérification que la route publish, pour qu'un formulaire déjà en
      // ligne ne puisse pas glisser vers un état invalide et être servi
      // immédiatement (jusqu'ici `checkPublishable` n'était appelé qu'à la
      // publication — S5). `force: true` reste un échappatoire assumé pour
      // un hotfix. Les 8 slugs semés n'atteignent jamais ce point : la garde
      // ci-dessus les a déjà arrêtés si leurs `fields` changeaient vraiment.
      if (existing.status === "published" && body.force !== true) {
        const issues = checkPublishable(
          clean,
          (existing.technicalSchema as unknown as AcroFieldRaw[]) || [],
          (existing.locales as unknown as Locale[]) || ["fr"],
          {
            visualFieldsRaw: existing.visualFields,
            visualFieldsMaterializedAt: existing.visualFieldsMaterializedAt,
            updatedAt: existing.updatedAt,
            bindingRules: getRulesForSlug(existing.slug),
          }
        );
        if (hasBlockingIssues(issues)) {
          return NextResponse.json(
            { error: "Modification refusée : le formulaire publié deviendrait invalide.", issues },
            { status: 422, headers: json }
          );
        }
      }
    }
  }

  try {
    // Écritures groupées en transaction : la révision (snapshot de l'état AVANT
    // modification) et l'update doivent réussir ou échouer ensemble. L'update final
    // porte un `where` composé `{ id, updatedAt: existing.updatedAt }` : si une autre
    // session a écrit entre le findUnique et ici, aucune ligne ne matche → P2025,
    // attrapé plus bas et renvoyé en 409. La transaction garantit alors qu'aucune
    // révision orpheline n'est laissée derrière.
    const updated = await prisma.$transaction(async (tx) => {
      if (createRevision) {
        await tx.pdfFormRevision.create({
          data: {
            formId: existing.id,
            version: existing.version,
            fields: existing.fields as Prisma.InputJsonValue,
            technicalSchema: existing.technicalSchema as Prisma.InputJsonValue,
            sourceSha256: existing.sourceSha256,
            sourceFileName: existing.sourceFileName,
            changeType: typeof body.changeType === "string" ? (body.changeType as string) : "minor",
            changeNotes: typeof body.changeNotes === "string" ? (body.changeNotes as string) : null,
            createdBy: auth.user.id,
          },
        });
      }
      return tx.pdfForm.update({
        where: { id, updatedAt: existing.updatedAt },
        data,
      });
    });
    return NextResponse.json(updated, { headers: json });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      // P2025 : record not found. Soit l'update n'a matché aucune ligne (le `where`
      // updatedAt a changé = course gagnée par une autre session → conflit), soit une
      // relation pointe vers un id inexistant (ex: organisme.connect) → référence invalide.
      if (err.code === "P2025") {
        // Si la ligne existe toujours mais avec un autre updatedAt, c'est un conflit.
        const current = await prisma.pdfForm.findUnique({
          where: { id },
          select: { updatedAt: true },
        });
        if (current && current.updatedAt.getTime() !== existing.updatedAt.getTime()) {
          return staleWriteResponse(current.updatedAt);
        }
        return NextResponse.json(
          { error: "Référence invalide : un élément lié est introuvable.", code: "invalid_reference" },
          { status: 400, headers: json }
        );
      }
      // P2002 : contrainte d'unicité violée.
      if (err.code === "P2002") {
        return NextResponse.json(
          { error: "Conflit d'unicité : une valeur déjà utilisée empêche l'enregistrement.", code: "unique_conflict" },
          { status: 409, headers: json }
        );
      }
    }
    console.error("PATCH /api/admin/pdf/forms/[id] — échec d'écriture", err);
    return NextResponse.json(
      { error: "Erreur serveur lors de l'enregistrement." },
      { status: 500, headers: json }
    );
  }
}

/// Réponse 409 standard pour un conflit d'édition (verrou optimiste).
/// `currentUpdatedAt` permet au client de se resynchroniser sans refetch s'il le souhaite.
function staleWriteResponse(currentUpdatedAt: Date) {
  return NextResponse.json(
    {
      error:
        "Conflit d'édition : ce formulaire a été modifié depuis votre dernier chargement. Rechargez pour voir la dernière version.",
      code: STALE_WRITE_CODE,
      currentUpdatedAt,
    },
    { status: 409, headers: json }
  );
}

/// DELETE — archive par défaut. `?hard=true&confirmSlug=<slug>` = définitif
/// (cascade revisions/submissions/drafts + suppression du PDF source).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const writeBlock = await ensureWriteAllowed();
  if (writeBlock) return writeBlock;

  const { id } = await params;
  const url = new URL(req.url);
  const hard = url.searchParams.get("hard") === "true";

  const form = await prisma.pdfForm.findUnique({ where: { id } });
  if (!form) return NextResponse.json({ error: "Introuvable" }, { status: 404, headers: json });

  if (!hard) {
    await prisma.pdfForm.update({ where: { id }, data: { status: "archived" } });
    return NextResponse.json({ ok: true, archived: true }, { headers: json });
  }

  if (url.searchParams.get("confirmSlug") !== form.slug) {
    return NextResponse.json(
      { error: "Confirmation invalide", expectedSlug: form.slug },
      { status: 422, headers: json }
    );
  }

  await deleteSourcePdf(form.sourceStoragePath).catch(() => {});
  await prisma.pdfForm.delete({ where: { id } });
  return NextResponse.json({ ok: true, hardDeleted: true }, { headers: json });
}
