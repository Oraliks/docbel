import { notFound } from "next/navigation";
import { headers, cookies } from "next/headers";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { BundleRunner } from "@/components/docbel/bundle-runner";
import { DossierJourneyIntro } from "@/components/docbel/dossier-journey-intro";
import { serializeJourneyWarnings, serializeJourneyDocuments } from "@/lib/dossiers/journey";
import { DossierEnConstruction } from "@/components/docbel/dossier-en-construction";
import { parseOfficialSources } from "@/lib/bundles/types";
import type { PdfFormField } from "@/lib/pdf-forms/types";
import { collectAllTriggeredSlugs } from "@/lib/pdf-forms/triggers";
import type { BundleCondition } from "@/lib/bundles/conditions";
import { parseEligibilityAnswers } from "@/lib/bundles/eligibility";
import { getDossier } from "@/lib/dossiers/registry";
import { parseOrientationAnswers } from "@/lib/dossiers/orientation";
import { dossierQuestionsToEligibility, selectDocuments, type DossierAnswers } from "@/lib/dossiers/types";
import { getLocale } from "next-intl/server";
import { localizeRecord } from "@/lib/i18n/content";

export const dynamic = "force-dynamic";

const BUNDLE_COOKIE = "beldoc-bundle-session";
/// Cookie posé par le wizard d'orientation (cf. dossier-wizard.tsx). Lu ici
/// SANS le supprimer — il est consommé (et effacé) à la création du run.
const ORIENTATION_COOKIE = "beldoc-orientation";

export default async function BundleRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = await getLocale();

  const bundleRaw = await prisma.documentBundle.findUnique({
    where: { slug },
    include: {
      items: {
        orderBy: { order: "asc" },
        include: {
          pdfForm: {
            select: {
              id: true, slug: true, title: true, description: true,
              issuer: true, fields: true, triggers: true,
            },
          },
        },
      },
    },
  });

  if (!bundleRaw) notFound();
  // Superpose les traductions du contenu DB (NL/EN…) avec fallback FR.
  // No-op si locale=fr ; ne touche que name/description/organism (scalaires).
  const bundle = await localizeRecord(
    "DocumentBundle",
    bundleRaw,
    ["name", "description", "organism"],
    locale,
  );
  // Dossier existant mais inactif (stub « à créer ») → page « en construction »
  // plutôt qu'un 404 sec (l'utilisateur a été orienté ici par le wizard).
  if (!bundle.active) {
    return (
      <DossierEnConstruction
        name={bundle.name}
        description={bundle.description}
        organism={bundle.organism}
        officialSources={parseOfficialSources(bundle.officialSources)}
      />
    );
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id || null;
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(BUNDLE_COOKIE)?.value || null;

  let run = null;
  if (userId || sessionId) {
    const where = userId
      ? { bundleId: bundle.id, userId, status: "in_progress" }
      : { bundleId: bundle.id, sessionId: sessionId!, status: "in_progress" };
    run = await prisma.bundleRun.findFirst({ where, orderBy: { startedAt: "desc" } });
  }

  // Un run « in_progress » VIDE (aucune réponse, aucun document rempli, aucun
  // payload) ne doit PAS compter comme une reprise : sinon l'écran
  // d'explication (journey) ET la pré-qualification sont sautés à tort, et on
  // tombe direct sur un parcours vide (bug constaté en prod). On ne traite
  // comme « en cours » qu'un run avec une progression réelle ; sinon on repart
  // comme un nouveau visiteur — le run vide sera réutilisé à la reprise (le
  // POST /run retrouve le run in_progress existant par session/utilisateur).
  const runHasProgress = Boolean(
    run &&
      ((((run.completedTemplateIds as string[] | null)?.length ?? 0) > 0) ||
        Object.keys(parseEligibilityAnswers(run.eligibilityAnswers)).length > 0 ||
        Object.keys((run.payloads as Record<string, unknown> | null) ?? {}).length > 0),
  );
  const effectiveRun = runHasProgress ? run : null;

  const payloads =
    (effectiveRun?.payloads as Record<string, Record<string, unknown>>) || {};

  const fieldLabels: Record<string, string> = {};
  const templateNames: Record<string, string> = {};
  for (const item of bundle.items) {
    if (item.pdfForm) {
      templateNames[item.pdfForm.id] = item.pdfForm.title;
      const fields = (item.pdfForm.fields as unknown as PdfFormField[]) || [];
      for (const f of fields) {
        const label = f.label?.fr || f.label?.nl || f.label?.de || f.id;
        fieldLabels[`${item.pdfForm.id}::${f.id}`] = label;
      }
    }
  }

  // --- Évaluation des déclencheurs (logique partagée, cf. lib/pdf-forms/triggers.ts) ---
  const triggeredSlugsList = collectAllTriggeredSlugs(
    bundle.items.map((it) => ({
      pdfFormId: it.pdfFormId,
      pdfFormSlug: it.pdfForm?.slug ?? null,
      rawTriggers: it.pdfForm?.triggers,
    })),
    payloads,
  );
  const triggeredSlugs = new Set(triggeredSlugsList);

  // Charge les PdfForms cibles depuis leur slug (un seul query) et matérialise
  // des items virtuels (sans DocumentBundleItem en DB).
  const triggeredForms =
    triggeredSlugs.size > 0
      ? await prisma.pdfForm.findMany({
          where: { slug: { in: [...triggeredSlugs] }, status: "published", active: true },
          select: {
            id: true, slug: true, title: true, description: true, issuer: true, fields: true,
          },
        })
      : [];

  for (const f of triggeredForms) {
    templateNames[f.id] = f.title;
    const fields = (f.fields as unknown as PdfFormField[]) || [];
    for (const fld of fields) {
      const label = fld.label?.fr || fld.label?.nl || fld.label?.de || fld.id;
      fieldLabels[`${f.id}::${fld.id}`] = label;
    }
  }

  // Code-driven dossiers (TS) prennent la priorité sur les questions stockées
  // en DB sur le DocumentBundle. Permet d'avoir le code comme source de
  // vérité sans avoir à reseeder la DB à chaque évolution du questionnaire.
  const dossierForQuestions = getDossier(slug);
  const eligibilityQuestionsSerialized = dossierForQuestions
    ? dossierQuestionsToEligibility(dossierForQuestions.questions)
    : bundle.eligibilityQuestions;

  const serializedBundle = {
    id: bundle.id,
    slug: bundle.slug,
    name: bundle.name,
    description: bundle.description,
    color: bundle.color,
    eligibilityQuestions: eligibilityQuestionsSerialized,
    warnings: bundle.warnings,
    items: [
      ...bundle.items.map((it) => ({
        id: it.id,
        templateId: null as string | null,
        pdfFormId: it.pdfFormId,
        order: it.order,
        required: it.required,
        condition: (it.condition as unknown as BundleCondition) ?? null,
        template: null,
        triggered: false as const,
        pdfForm: it.pdfForm
          ? {
              id: it.pdfForm.id,
              slug: it.pdfForm.slug,
              title: it.pdfForm.title,
              description: it.pdfForm.description,
              issuer: it.pdfForm.issuer,
            }
          : null,
      })),
      // Items virtuels matérialisés par les triggers — affichés en bas du
      // parcours, marqués `triggered: true` pour que le runner les distingue.
      ...triggeredForms.map((f, idx) => ({
        id: `triggered-${f.id}`,
        templateId: null as string | null,
        pdfFormId: f.id,
        order: bundle.items.length + idx,
        required: true,
        condition: null as BundleCondition,
        template: null,
        triggered: true as const,
        pdfForm: {
          id: f.id,
          slug: f.slug,
          title: f.title,
          description: f.description,
          issuer: f.issuer,
        },
      })),
    ],
  };

  const dossier = getDossier(slug);
  let eligibilityAnswers = parseEligibilityAnswers(effectiveRun?.eligibilityAnswers);

  // Chaînage orientation → pré-qualification : si l'utilisateur arrive du
  // wizard (cookie `beldoc-orientation`, consommé plus tard à la création du
  // run) et qu'aucun run réel n'existe encore, on PRÉ-SÉLECTIONNE les réponses
  // que le wizard connaît déjà — uniquement si le wizard a résolu vers CE
  // dossier. L'utilisateur voit ces réponses dans la pré-qualification et peut
  // les modifier avant de démarrer (informatif, jamais bloquant).
  if (!effectiveRun && dossier?.prefillFromOrientation) {
    const orientation = parseOrientationAnswers(
      cookieStore.get(ORIENTATION_COOKIE)?.value,
    );
    if (orientation && orientation.slug === slug) {
      eligibilityAnswers = {
        ...dossier.prefillFromOrientation(orientation),
        ...eligibilityAnswers,
      };
    }
  }
  const selectedDocs = dossier
    ? selectDocuments(dossier, eligibilityAnswers as unknown as DossierAnswers)
    : null;
  const applicableSlugs = selectedDocs ? selectedDocs.map((d) => d.slug) : null;
  // Les formulaires matérialisés par trigger sont toujours applicables — on
  // les rajoute aux applicables pour qu'ils ne soient pas masqués par le
  // filtre dossier.
  const finalApplicableSlugs = applicableSlugs
    ? [...applicableSlugs, ...triggeredSlugs]
    : null;

  // Documents à charge d'un tiers (employeur, ONEM, mutuelle…) : pas remplis
  // dans beldoc mais obligatoires au dossier. On les sérialise séparément
  // pour que le runner affiche une carte « à fournir par un tiers ».
  const externalDocuments =
    selectedDocs
      ?.flatMap((d) => {
        const r = d.responsibility;
        if (!r || r === "user") return [];
        return [
          {
            slug: d.slug,
            title: d.title,
            issuer: d.issuer,
            required: d.required ?? true,
            responsibility: r,
            responsibilityNote: d.responsibilityNote?.fr ?? null,
            responsibilityUrl: d.responsibilityUrl?.fr ?? null,
          },
        ];
      }) ?? [];

  // Pleine largeur : la page remplit le shell public (max-w-[1840px]) comme
  // /mon-dossier — le BundleRunner (cartes parcours/documents) occupe toute la
  // largeur disponible plutôt que d'être « collé au centre ».
  // Issuer principal du dossier — affiché dans le breadcrumb pour donner
  // un repère à l'utilisateur ("Accueil > Mon dossier > ONEM"). On le
  // dérive du premier PdfForm du bundle (typiquement tous du même
  // organisme). Fallback "Documents" si non disponible.
  const dossierIssuer = bundle.items.find((it) => it.pdfForm?.issuer)?.pdfForm?.issuer ?? "Documents";

  return (
    <div className="w-full">
      {/*
        Breadcrumb : repère de navigation cohérent avec /document/[slug]
        (cf. components/pdf-forms/document-page-layout.tsx). Sert aux gens
        qui arrivent depuis un email de reprise et veulent comprendre où
        ils sont.
      */}
      <nav
        className="mb-4 flex items-center gap-1 text-xs text-[color:var(--glass-ink-soft)]"
        aria-label="Fil d'Ariane"
      >
        <Link href="/" className="hover:underline">Accueil</Link>
        <span aria-hidden>›</span>
        <Link href="/mon-dossier" className="hover:underline">Mon dossier</Link>
        <span aria-hidden>›</span>
        <span>{dossierIssuer}</span>
        <span aria-hidden>›</span>
        <span className="truncate text-[color:var(--glass-ink)]">{bundle.name}</span>
      </nav>

      {(() => {
        const runnerProps = {
          bundle: serializedBundle,
          runId: effectiveRun?.id ?? null,
          resumeCode: effectiveRun?.resumeCode ?? null,
          resumeCodeExpiresAt: effectiveRun?.resumeCodeExpiresAt?.toISOString() ?? null,
          resumeEmail: effectiveRun?.resumeEmail ?? null,
          eligibilityAnswers,
          completedTemplateIds: (effectiveRun?.completedTemplateIds as string[]) || [],
          payloads,
          templateNames,
          fieldLabels,
          applicableSlugs: finalApplicableSlugs,
          externalDocuments,
          userEmail: session?.user?.email ?? null,
        };

        // Écran d'explication : uniquement si le dossier codé fournit un
        // `journey` + un libellé CTA, ET qu'aucun run RÉEL n'est en cours (un
        // run vide ne compte pas — cf. runHasProgress ci-dessus). Un visiteur
        // qui reprend un dossier réellement entamé va droit au questionnaire.
        const showJourney =
          dossier?.journey && dossier.journeyCtaLabel && !effectiveRun;

        if (showJourney) {
          return (
            <DossierJourneyIntro
              journey={dossier!.journey!}
              warnings={serializeJourneyWarnings(
                dossier!.warnings,
                eligibilityAnswers as unknown as DossierAnswers,
              )}
              documents={serializeJourneyDocuments(selectedDocs ?? [])}
              ctaLabel={dossier!.journeyCtaLabel!}
              ctaLabelKey={dossier!.journeyCtaLabelKey}
              {...runnerProps}
            />
          );
        }

        return <BundleRunner {...runnerProps} />;
      })()}
    </div>
  );
}
