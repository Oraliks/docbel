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
import { parseEligibilityAnswers, parseEligibilityQuestions } from "@/lib/bundles/eligibility";
import { loadPublishedTreeContent } from "@/lib/decision-builder/loader";
import {
  collectCanonicalFacts,
  prefillEligibilityAnswers,
} from "@/lib/parcours/canonical-facts";
import { getDossier } from "@/lib/dossiers/registry";
import { parseOrientationAnswers } from "@/lib/dossiers/orientation";
import { dossierQuestionsToEligibility, selectDocuments, type DossierAnswers } from "@/lib/dossiers/types";
import { getLocale } from "next-intl/server";
import { localizeRecord } from "@/lib/i18n/content";
import { EDITABLE_BUNDLE_RUN_STATUSES } from "@/lib/bundles/run-lifecycle";
import { bundleRunHasProgress } from "@/lib/bundles/run-progress";
import { buildDemandeSummaries } from "@/lib/bundles/demande-summary";
import { DemandeList } from "@/components/docbel/demande-list";

export const dynamic = "force-dynamic";

const BUNDLE_COOKIE = "beldoc-bundle-session";
/// Cookie posé par le wizard d'orientation (cf. dossier-wizard.tsx). Lu ici
/// SANS le supprimer — il est consommé (et effacé) à la création du run.
const ORIENTATION_COOKIE = "beldoc-orientation";

export default async function BundleRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ demarrer?: string; bundleRun?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  // `?demarrer=1` = parcours guidé / reprise → ouverture directe du formulaire
  // principal (opt-in). Sans ce paramètre, l'URL affiche la liste « Documents
  // du parcours » (accès direct / « En savoir plus »). `?bundleRun=<id>` cible
  // UNE demande précise (multi-demande).
  const autoStart = sp.demarrer === "1";
  const bundleRunParam = sp.bundleRun ?? null;
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

  // TOUTES les demandes éditables du (dossier, utilisateur/session). La requête
  // est bornée par userId/sessionId → `allRuns` ne contient QUE les runs de
  // l'appelant (pas de cross-tenant possible sur un `?bundleRun` deviné).
  const allRuns =
    userId || sessionId
      ? await prisma.bundleRun.findMany({
          where: userId
            ? { bundleId: bundle.id, userId, status: { in: [...EDITABLE_BUNDLE_RUN_STATUSES] } }
            : {
                bundleId: bundle.id,
                sessionId: sessionId!,
                status: { in: [...EDITABLE_BUNDLE_RUN_STATUSES] },
              },
          orderBy: { startedAt: "desc" },
        })
      : [];

  // Un run VIDE (aucune réponse, document, payload) ne compte pas comme une
  // reprise (sinon journey/pré-qualif sautés à tort — bug prod). On ne garde
  // comme « en cours » que les runs AVEC progression.
  const runsWithProgress = allRuns.filter((r) =>
    bundleRunHasProgress({
      completedTemplateIds: r.completedTemplateIds,
      eligibilityAnswers: r.eligibilityAnswers,
      payloads: r.payloads,
    }),
  );

  // Demande ciblée par `?bundleRun` (déjà bornée à l'appelant via allRuns).
  const targeted = bundleRunParam
    ? allRuns.find((r) => r.id === bundleRunParam) ?? null
    : null;

  // Entrée HYBRIDE : 2+ demandes avec progression, sans ciblage ni démarrage
  // explicite → écran « Mes demandes ». Sinon on ouvre la demande ciblée, ou la
  // plus récente avec progression (0/1 → comportement historique).
  const showDemandeList = !targeted && !autoStart && runsWithProgress.length >= 2;
  const effectiveRun = targeted ?? runsWithProgress[0] ?? null;

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
  // Ids des questions pré-remplies depuis l'orientation (badge « d'après vos réponses »).
  const orientationAnswerIds: string[] = [];

  // Chaînage orientation → pré-qualification : si l'utilisateur arrive du
  // wizard (cookie `beldoc-orientation`, consommé plus tard à la création du
  // run) et qu'aucun run réel n'existe encore, on PRÉ-SÉLECTIONNE les réponses
  // que le wizard connaît déjà — informatif, jamais bloquant.
  if (!effectiveRun) {
    const orientation = parseOrientationAnswers(
      cookieStore.get(ORIENTATION_COOKIE)?.value,
    );
    if (orientation && orientation.slug === slug) {
      // (a) Prefill existant des dossiers CODÉS (inchangé).
      if (dossier?.prefillFromOrientation) {
        eligibilityAnswers = {
          ...dossier.prefillFromOrientation(orientation),
          ...eligibilityAnswers,
        };
      }
      // (b) Prefill par CLÉS CANONIQUES depuis l'arbre publié. Repli sûr :
      // arbre indisponible / options sans tag / questions sans tag → aucun fait.
      const treeContent = await loadPublishedTreeContent("chomage");
      if (treeContent) {
        const chosenIds = [
          orientation.situation,
          orientation.subOption,
          orientation.refine,
        ].filter((v): v is string => typeof v === "string");
        const chosenOptions = chosenIds
          .map((id) => treeContent.nodes[id])
          .filter((n) => n?.type === "option") as {
          canonical?: { key: string; value: string };
        }[];
        const facts = collectCanonicalFacts(chosenOptions);
        // Source = l'ensemble RÉELLEMENT AFFICHÉ au runner
        // (`eligibilityQuestionsSerialized`), pas le JSON DB brut : pour un
        // dossier CODÉ, l'affiché vient du code (sans champ canonique → prefill
        // vide, aucune clé fantôme injectée dans selectDocuments) ; pour un
        // dossier DB, c'est le même JSON avec les tags. On préremplit donc
        // uniquement des questions effectivement montrées.
        const questions = parseEligibilityQuestions(eligibilityQuestionsSerialized);
        const canonicalPrefill = prefillEligibilityAnswers(questions, facts);
        for (const qid of Object.keys(canonicalPrefill)) {
          // Ne pas écraser une réponse déjà présente (run/prefill code).
          if (eligibilityAnswers[qid] === undefined) {
            eligibilityAnswers[qid] = canonicalPrefill[qid];
            orientationAnswerIds.push(qid);
          }
        }
      }
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

      {showDemandeList ? (
        <DemandeList
          bundleId={bundle.id}
          slug={bundle.slug}
          bundleName={bundle.name}
          demandes={buildDemandeSummaries(
            runsWithProgress.map((r) => ({
              id: r.id,
              startedAt: r.startedAt,
              completedTemplateIds: r.completedTemplateIds,
              status: r.status,
              completedAt: r.completedAt,
              anonymizedAt: r.anonymizedAt,
            })),
            bundle.items.length,
          )}
        />
      ) : (() => {
        const runnerProps = {
          bundle: serializedBundle,
          runId: effectiveRun?.id ?? null,
          resumeCode: effectiveRun?.resumeCode ?? null,
          resumeCodeExpiresAt: effectiveRun?.resumeCodeExpiresAt?.toISOString() ?? null,
          resumeEmail: effectiveRun?.resumeEmail ?? null,
          eligibilityAnswers,
          orientationAnswerIds,
          completedTemplateIds: (effectiveRun?.completedTemplateIds as string[]) || [],
          payloads,
          templateNames,
          fieldLabels,
          applicableSlugs: finalApplicableSlugs,
          externalDocuments,
          userEmail: session?.user?.email ?? null,
          autoStart,
        };

        // Écran d'explication : uniquement si le dossier codé fournit un
        // `journey` + un libellé CTA, ET qu'aucun run RÉEL n'est en cours (un
        // run vide ne compte pas — cf. runHasProgress ci-dessus). Le parcours
        // guidé (`?demarrer=1`) va directement au Form Runner ; l'accès manuel
        // garde cette présentation avant le démarrage.
        const showJourney =
          dossier?.journey && dossier.journeyCtaLabel && !effectiveRun && !autoStart;

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
