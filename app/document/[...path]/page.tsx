import { notFound, permanentRedirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toPublicForm } from "@/lib/pdf-forms/public-serializer";
import { isDoccleConfigured } from "@/lib/pdf-forms/integrations/doccle";
import { isItsmeConfigured } from "@/lib/pdf-forms/integrations/itsme";
import { DocumentPageLayout } from "@/components/pdf-forms/document-page-layout";
import { getFormContextTips } from "@/lib/form-context-tips.server";
import { DisabledFormView } from "./disabled-form-view";
import { getDossier } from "@/lib/dossiers/registry";
import { familyAnswersToC1Prefill } from "@/lib/dossiers/family-prefill";
import { orientationAnswersToC1Prefill } from "@/lib/dossiers/orientation";
import type { PdfFormField, FormPayload } from "@/lib/pdf-forms/types";
import { pickInitialStepId } from "@/lib/pdf-forms/resume-step";
import { buildProfilePrefill } from "@/lib/pdf-forms/profile-prefill";
import {
  applySharedValuesToForm,
  extractSharedValues,
  mergeSharedValues,
  type SharedBundleValues,
} from "@/lib/bundles/shared-values";
import {
  canonicalToPrefill,
  extractCanonical,
  mergeCanonical,
  type CanonicalMap,
  type PrefillMap,
} from "@/lib/pdf-forms/canonical/extract";

export const dynamic = "force-dynamic";

type LoadFormResult =
  | { kind: "missing" }
  | { kind: "disabled"; title: string; disabledMessage: string | null }
  | {
      kind: "ok";
      form: ReturnType<typeof toPublicForm> & {
        allowDoccle: boolean;
        allowItsme: boolean;
        publicPath: string | null;
      };
    };

/// Résolution unifiée du PdfForm à partir des segments d'URL captés par le
/// catch-all `[...path]`. Deux formes acceptées :
///   • 1 segment  → interprété comme `slug` interne (compat historique).
///   • 2+ segments → interprétés comme `publicPath` (segments joints par "/").
///
/// La forme SLUG applique une règle supplémentaire (Phase 3 du plan bindings) :
/// si le PdfForm cible porte un `publicPath`, on redirige 308 vers l'URL
/// publique canonique. Ainsi `/document/c1-changement-situation` renvoie
/// `/document/onem/c1` de manière permanente et cohérente pour les liens
/// déjà partagés + le SEO.
async function loadForm(
  path: readonly string[]
): Promise<
  | LoadFormResult
  | { kind: "redirect"; publicPath: string }
> {
  if (path.length === 0) return { kind: "missing" };
  const form =
    path.length === 1
      ? await prisma.pdfForm.findUnique({ where: { slug: path[0] } })
      : await prisma.pdfForm.findFirst({ where: { publicPath: path.join("/") } });
  if (!form || form.status !== "published") return { kind: "missing" };
  // Redirection SLUG → publicPath quand disponible (URL publique canonique).
  if (path.length === 1 && form.publicPath) {
    return { kind: "redirect", publicPath: form.publicPath };
  }
  if (form.active === false) {
    return { kind: "disabled", title: form.title, disabledMessage: form.disabledMessage };
  }
  const pub = toPublicForm(form);
  return {
    kind: "ok",
    form: {
      ...pub,
      publicPath: form.publicPath,
      allowDoccle: pub.allowDoccle && isDoccleConfigured(),
      allowItsme: pub.allowItsme && isItsmeConfigured(),
    },
  };
}

/// Charge les valeurs partagées du bundle si on est ouvert dans le contexte
/// d'un dossier. Lit BundleRun.payloads et reconstruit la map prefillFrom →
/// valeur en re-passant par le schéma des PDFs déjà complétés.
async function loadBundleSharedValues(
  bundleRunId: string,
  currentFormId: string,
  ownership: { userId: string | undefined; sessionId: string | null }
): Promise<{
  shared: SharedBundleValues;
  canonical: CanonicalMap;
  runValid: boolean;
  /// Reprise fine (Lot 3) : dernier formulaire/étape actifs + brouillon en cours
  /// du formulaire COURANT (réponses non validées à restaurer).
  lastFormId: string | null;
  lastStepId: string | null;
  draftForForm: FormPayload | undefined;
  eligibilityAnswers: Record<string, string>;
  orientationAnswers: unknown;
}> {
  const invalid = {
    shared: {},
    canonical: {},
    runValid: false as const,
    lastFormId: null,
    lastStepId: null,
    draftForForm: undefined,
    eligibilityAnswers: {},
    orientationAnswers: null,
  };
  const run = await prisma.bundleRun.findUnique({
    where: { id: bundleRunId },
    include: {
      bundle: {
        include: {
          items: {
            include: {
              pdfForm: { select: { id: true, fields: true } },
            },
          },
        },
      },
    },
  });
  if (!run || run.status !== "in_progress") {
    return invalid;
  }
  // Propriété du run (même logique que app/api/documents/bundles/[id]/run/route.ts) :
  // sans ce contrôle, un `bundleRunId` deviné suffirait à lire les valeurs
  // partagées (NISS, adresse…) d'un autre citoyen.
  const owns = ownership.userId
    ? run.userId === ownership.userId
    : ownership.sessionId
      ? run.sessionId === ownership.sessionId
      : false;
  if (!owns) {
    return invalid;
  }

  const payloads = (run.payloads as Record<string, Record<string, unknown>>) || {};
  // On collecte les valeurs partagées de tous les PDFs DÉJÀ complétés (qui ne
  // sont PAS le courant — sinon on annule notre propre saisie en cours).
  //
  // Deux mécanismes complémentaires depuis Phase 2 du plan bindings :
  //   • `extractSharedValues` par `prefillFrom` (mécanisme historique) :
  //     couvre les champs pré-remplissables (`profile.niss`, `itsme.*`).
  //   • `extractCanonical` par `canonicalKey` (nouveau) : couvre le
  //     vocabulaire canonique explicite (`identity.nom`, `banque.iban`, …)
  //     qui ne dépend pas de la source de prefill du champ.
  const sharedMaps: SharedBundleValues[] = [];
  const canonicalMaps: CanonicalMap[] = [];
  for (const item of run.bundle.items) {
    if (!item.pdfForm || item.pdfForm.id === currentFormId) continue;
    const payload = payloads[item.pdfForm.id];
    if (!payload) continue;
    const fields = (item.pdfForm.fields as unknown as PdfFormField[]) || [];
    sharedMaps.push(extractSharedValues(fields, payload));
    canonicalMaps.push(extractCanonical(fields, payload));
  }
  // Réponses du formulaire courant à restaurer au montage du runner, à la PLUS
  // HAUTE précédence (priment sur profil + prefill inter-documents). Deux
  // sources, dans l'ordre :
  //   1. `draftPayloads[currentFormId]` — brouillon EN COURS (saisie non encore
  //      validée). Prioritaire tant qu'il existe (dernière frappe de l'usager).
  //   2. `payloads[currentFormId]` — réponses DÉJÀ VALIDÉES. À la validation
  //      (delivery="save"), le brouillon est PURGÉ et les réponses migrent ici.
  //      Sans ce fallback, revenir corriger un formulaire terminé (ex. rouvrir
  //      le C1 après avoir commencé l'Annexe REGIS) le rouvrait VIDE — toutes
  //      les données semblaient remises à zéro (bug Oraliks 2026-07-18), alors
  //      qu'elles sont bien conservées dans `payloads`.
  const draftPayloads =
    (run.draftPayloads as Record<string, Record<string, unknown>> | null) || {};
  const draftForForm = (draftPayloads[currentFormId] ?? payloads[currentFormId]) as
    | FormPayload
    | undefined;

  return {
    shared: mergeSharedValues(...sharedMaps),
    canonical: mergeCanonical(...canonicalMaps),
    runValid: true,
    lastFormId: run.lastFormId,
    lastStepId: run.lastStepId,
    draftForForm,
    eligibilityAnswers: (run.eligibilityAnswers as Record<string, string> | null) ?? {},
    orientationAnswers: run.orientationAnswers,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ path: string[] }>;
}): Promise<Metadata> {
  const { path } = await params;
  const t = await getTranslations("public.contenu");
  const res = await loadForm(path);
  if (res.kind === "missing") return { title: t("formMetaUnavailable") };
  if (res.kind === "redirect") return { title: t("formMetaUnavailable") };
  if (res.kind === "disabled")
    return { title: t("formMetaDisabledTitle", { title: res.title }) };
  // Canonical : URL SEO publique dès qu'un `publicPath` est disponible ;
  // sinon fallback vers l'URL slug (compatibilité pré-Phase 3).
  const canonical = res.form.publicPath
    ? `/document/${res.form.publicPath}`
    : `/document/${res.form.slug}`;
  return {
    title: t("formMetaTitle", { title: res.form.title }),
    description: res.form.description ?? undefined,
    alternates: { canonical },
  };
}

export default async function PdfFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<{ bundleRun?: string; bundleSlug?: string }>;
}) {
  const { path } = await params;
  const { bundleRun, bundleSlug } = await searchParams;
  const res = await loadForm(path);
  if (res.kind === "missing") notFound();
  if (res.kind === "redirect") {
    // Redirection slug → publicPath (URL canonique) EN PRÉSERVANT le contexte
    // dossier : sans ça, `bundleRun`/`bundleSlug` sont perdus et le formulaire
    // s'ouvre en mode autonome (ne se sauvegarde pas dans le dossier). Vaut pour
    // l'ouverture directe (parcours guidé) comme pour le bouton « Compléter ».
    const qs = new URLSearchParams();
    if (bundleRun) qs.set("bundleRun", bundleRun);
    if (bundleSlug) qs.set("bundleSlug", bundleSlug);
    const suffix = qs.toString();
    permanentRedirect(`/document/${res.publicPath}${suffix ? `?${suffix}` : ""}`);
  }
  if (res.kind === "disabled") {
    return (
      <div className="w-full">
        <DisabledFormView formTitle={res.title} customMessage={res.disabledMessage} />
      </div>
    );
  }
  const form = res.form;

  // Profil unique : si l'utilisateur est connecté, on récupère son profil et on
  // pré-remplit les champs canoniques (NISS, nom, adresse, IBAN…) via le même
  // mécanisme que le prefill cross-document. Anonyme → aucun prefill profil.
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  let profilePrefill: Record<string, string> | undefined;
  if (userId) {
    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    if (profile) {
      profilePrefill = buildProfilePrefill(form.fields, profile);
    }
  }

  // Contexte bundle : si on a un `bundleRun`, on récupère les valeurs déjà
  // saisies par l'utilisateur dans les autres PDFs du dossier (NISS, adresse…)
  // et on les injecte comme valeurs par défaut dans ce PDF. Deux voies
  // combinées (Phase 2 du plan bindings) :
  //   • par `prefillFrom` (historique) — même clé de prefill entre 2 PDFs ;
  //   • par `canonicalKey` (nouveau) — même clé sémantique (identity.nom,
  //     banque.iban, …) sans devoir aligner les sources de prefill.
  // Priorité au sein de bundlePrefill : `prefillFrom` prime (précision plus
  // fine — un champ prefillFrom itsme.niss ne doit pas se faire injecter la
  // valeur canonique d'un formulaire qui l'a extraite d'un profil).
  let bundlePrefill: PrefillMap | undefined;
  let validBundleRunId: string | undefined;
  // Reprise fine (Lot 3) : étape initiale du runner + réponses en cours à
  // restaurer (passées à la plus haute précédence dans le runner, préservant
  // tous les types — cases à cocher, listes — que `PrefillMap` ne porte pas).
  let initialStepId: string | undefined;
  let draftValues: FormPayload | undefined;
  if (bundleRun) {
    const sessionId = (await cookies()).get("beldoc-bundle-session")?.value || null;
    const {
      shared,
      canonical,
      runValid,
      lastFormId,
      lastStepId,
      draftForForm,
      eligibilityAnswers,
      orientationAnswers,
    } = await loadBundleSharedValues(bundleRun, form.id, { userId, sessionId });
    if (runValid) {
      validBundleRunId = bundleRun;
      const bySharedFrom = applySharedValuesToForm(form.fields, shared);
      const byCanonical = canonicalToPrefill(form.fields, canonical);
      // `byCanonical` peut contenir des `FullNameValue` (composite prénom+nom
      // pour un champ `type: "fullname"`), `bySharedFrom` uniquement des
      // strings. Priorité `prefillFrom` (précision plus fine, contexte plus
      // certain que la composition canonique) — donc bySharedFrom prime.
      bundlePrefill = { ...byCanonical, ...bySharedFrom };
      // L'assistant enrichi préremplit uniquement les champs de situation
      // familiale du C1. Le PDF officiel reste inchangé et chaque valeur est
      // modifiable dans le Form Runner.
      if (form.slug.startsWith("c1-")) {
        bundlePrefill = {
          ...familyAnswersToC1Prefill(eligibilityAnswers),
          ...bundlePrefill,
        };
      }
      initialStepId = pickInitialStepId(lastFormId, lastStepId, form.id);
      // Les cases issues de l'assistant sont des valeurs initiales. Un vrai
      // brouillon enregistré est fusionné ensuite et reste donc prioritaire
      // (ex. l'utilisateur a volontairement décoché la suggestion).
      const orientationPrefill = form.slug === "c1-changement-situation"
        ? orientationAnswersToC1Prefill(orientationAnswers)
        : {};
      const hasInitialValues =
        draftForForm !== undefined || Object.keys(orientationPrefill).length > 0;
      draftValues = hasInitialValues
        ? { ...orientationPrefill, ...(draftForForm ?? {}) }
        : undefined;
    }
  }

  // Précédence de fusion : le profil est la BASE, le contexte bundle ÉCRASE
  // (plus contextuel — l'utilisateur vient de saisir ces valeurs dans le
  // dossier en cours). On garde le nom de prop `bundlePrefill` pour le layout.
  const mergedPrefill: PrefillMap | undefined =
    profilePrefill || bundlePrefill
      ? { ...profilePrefill, ...bundlePrefill }
      : undefined;

  // Si le PDF est ouvert dans le contexte d'un dossier codé, on alimente
  // l'illustration animée avec les "types" déclarés par le dossier (ex. les
  // 7 motifs de chômage temporaire). Sinon : illustration sans cycle.
  const dossier = bundleSlug ? getDossier(bundleSlug) : null;
  const dossierTypes = dossier?.types;

  // Filet de sécurité : "1" bascule tous les formulaires PDF vers l'ancien
  // rendu (grille dense) sans redéploiement. Absent/tout autre valeur = nouveau
  // rendu compact (défaut).
  const legacyLayout = process.env.PDF_FORM_LEGACY_LAYOUT === "1";

  // Infos importantes contextuelles (panneau d'aide de gauche) : DB sur défauts,
  // résilient (jamais de throw). Passé jusqu'au ContextHelpPanel via le runner.
  const contextTips = await getFormContextTips(form.slug);

  return (
    <div className="flex w-full flex-col gap-4">
      <DocumentPageLayout
        form={form}
        bundlePrefill={mergedPrefill}
        bundleRunId={validBundleRunId}
        bundleSlug={bundleSlug}
        dossierTypes={dossierTypes}
        legacyLayout={legacyLayout}
        contextTips={contextTips}
        initialStepId={initialStepId}
        draftValues={draftValues}
        isAuthenticated={Boolean(userId)}
      />
    </div>
  );
}
