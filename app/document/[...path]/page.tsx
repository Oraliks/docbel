import { notFound, redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toPublicForm, type PublicField } from "@/lib/pdf-forms/public-serializer";
import { isDoccleConfigured } from "@/lib/pdf-forms/integrations/doccle";
import { isItsmeConfigured } from "@/lib/pdf-forms/integrations/itsme";
import { DocumentPageLayout } from "@/components/pdf-forms/document-page-layout";
import { getFormContextTips } from "@/lib/form-context-tips.server";
import { DisabledFormView } from "./disabled-form-view";
import { getDossier } from "@/lib/dossiers/registry";
import { familyAnswersToC1Prefill } from "@/lib/dossiers/family-prefill";
import { orientationAnswersToC1Prefill } from "@/lib/dossiers/orientation";
import type { FormPayload, FieldValue } from "@/lib/pdf-forms/types";
import { pickInitialStepId } from "@/lib/pdf-forms/resume-step";
import { buildProfilePrefill } from "@/lib/pdf-forms/profile-prefill";
import {
  applySharedValuesToForm,
  buildBundleSharedMaps,
  type SharedBundleValues,
} from "@/lib/bundles/shared-values";
import {
  canonicalToPrefill,
  mergePrefillSources,
  type CanonicalMap,
  type PrefillMap,
} from "@/lib/pdf-forms/canonical/extract";
import { applyDossierInheritance } from "@/lib/pdf-forms/dossier-inheritance";
import { loadDossierState } from "@/lib/bundles/completion";
import { isBundleRunEditable } from "@/lib/bundles/run-lifecycle";
import { buildDemarcheRailModel } from "@/lib/bundles/rail-model";
import type { DemarcheRailData } from "@/components/docbel/demarche-rail";

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
/// si le PdfForm cible porte un `publicPath`, on redirige (307, temporaire —
/// `publicPath` reste modifiable) vers l'URL publique canonique. Ainsi
/// `/document/c1-changement-situation` renvoie `/document/onem/c1`, de façon
/// cohérente pour les liens déjà partagés et le SEO.
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
            orderBy: { order: "asc" },
            include: {
              pdfForm: { select: { id: true, fields: true } },
            },
          },
        },
      },
    },
  });
  // `isBundleRunEditable` (au lieu de `run.status !== "in_progress"`) aligne
  // sur `loadDossierState` : un run `completed` legacy (status="completed" ou
  // completedAt posé) reste modifiable, donc garde son prefill cross-document,
  // son brouillon et son rail — seuls abandon/anonymisation ferment l'accès.
  if (!run || !isBundleRunEditable(run)) {
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
  // Valeurs partagées (prefillFrom + canonicalKey) de tous les PDFs DÉJÀ
  // complétés du bundle, hors le document courant. `run.bundle.items` est
  // trié par `order` croissant ci-dessus : en cas de doublon (même
  // `canonicalKey`/`prefillFrom` dans deux documents), celui déclaré en
  // premier dans le bundle gagne, de façon déterministe (S3, 2026-08-01) —
  // avant ce tri, le gagnant dépendait de l'ordre de retour, non garanti, de
  // la base.
  const { shared, canonical } = buildBundleSharedMaps(
    run.bundle.items.map((item) => ({
      pdfForm: item.pdfForm
        ? { id: item.pdfForm.id, fields: (item.pdfForm.fields as unknown as PublicField[]) || [] }
        : null,
    })),
    currentFormId,
    payloads
  );
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
    shared,
    canonical,
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
    // 307 (temporaire) et non 308 (permanent, mis en cache à vie par les
    // navigateurs) : un `publicPath` reste modifiable côté admin — un cache
    // permanent y survivrait.
    redirect(`/document/${res.publicPath}${suffix ? `?${suffix}` : ""}`);
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
  // `PrefillMap` et non `Record<string, string>` : le profil sait désormais
  // remplir les champs composites `fullname` (« Prénom et nom »), qui portent
  // un `{ first, last }` et non une chaîne.
  let profilePrefill: PrefillMap | undefined;
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
  let rail: DemarcheRailData | undefined;
  // Reprise fine (Lot 3) : étape initiale du runner + réponses en cours à
  // restaurer (passées à la plus haute précédence dans le runner, préservant
  // tous les types — cases à cocher, listes — que `PrefillMap` ne porte pas).
  let initialStepId: string | undefined;
  let draftValues: FormPayload | undefined;
  // Slug effectif du dossier : celui de l'URL, ou — s'il en est absent alors
  // qu'on a un `bundleRun` valide — celui du run chargé (dérivé plus bas).
  // Sans cette dérivation, ouvrir un document via un lien qui ne porte que
  // `bundleRun` (sans `bundleSlug`) affichait le formulaire silencieusement
  // SANS rail ni fil d'Ariane dossier (S3, 2026-08-01).
  let effectiveBundleSlug = bundleSlug;
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
      // Priorité à `canonicalKey` sur `prefillFrom` — cf. le pourquoi (et le
      // bug qu'inversait l'ordre historique) sur `mergePrefillSources`.
      bundlePrefill = mergePrefillSources(bySharedFrom, byCanonical);
      // Assistants du parcours (situation familiale, orientation) : ils
      // produisent des ids de champs du C1 (`statutFamilial`, `cohabiteType`…).
      // On ne garde que ceux que CE formulaire connaît réellement, au lieu de
      // filtrer sur le slug (2026-07-26). `startsWith("c1-")` visait le C1
      // mais attrapait aussi `c1-regis` et `c1-partenaire`, à qui on injectait
      // des clés inexistantes ; et il MANQUAIT `c1a`/`c1b`/`c1c`, qui ne
      // commencent pas par « c1- ». Le filtre par la donnée n'a ni faux
      // positif ni faux négatif, et un futur formulaire portant ces champs en
      // bénéficiera sans qu'on touche à ce fichier.
      const idsDuFormulaire = new Set(form.fields.map((f) => f.id));
      const gardeChampsConnus = (prefill: Record<string, FieldValue>): PrefillMap =>
        Object.fromEntries(
          Object.entries(prefill).filter(
            ([id, valeur]) => idsDuFormulaire.has(id) && valeur !== null
          )
        ) as PrefillMap;

      // Le PDF officiel reste inchangé et chaque valeur est modifiable dans le
      // Form Runner.
      bundlePrefill = {
        ...gardeChampsConnus(familyAnswersToC1Prefill(eligibilityAnswers)),
        ...bundlePrefill,
      };
      initialStepId = pickInitialStepId(lastFormId, lastStepId, form.id);
      // Les cases issues de l'assistant sont des valeurs initiales. Un vrai
      // brouillon enregistré est fusionné ensuite et reste donc prioritaire
      // (ex. l'utilisateur a volontairement décoché la suggestion).
      const orientationPrefill = gardeChampsConnus(
        orientationAnswersToC1Prefill(orientationAnswers) as Record<string, FieldValue>
      );
      const hasInitialValues =
        draftForForm !== undefined || Object.keys(orientationPrefill).length > 0;
      draftValues = hasInitialValues
        ? { ...orientationPrefill, ...(draftForForm ?? {}) }
        : undefined;
    }

    // Rail de démarche : état complet du dossier (items + déclenchés + verrou),
    // MÊME source que le 409 dossier_incomplete. Ownership re-vérifiée dedans.
    // Chargé dès que le run est valide — `bundleSlug` n'est plus une
    // condition d'entrée : sert aussi à dériver le slug manquant de l'URL.
    // Un `bundleSlug` d'URL qui ne correspond PAS au run chargé reste ignoré
    // (garde anti-tampering inchangée : jamais de rail sur un mismatch).
    if (runValid) {
      const dossierState = await loadDossierState(bundleRun, {
        userId: userId ?? null,
        sessionId,
      });
      const slugToCheck = bundleSlug ?? dossierState?.run.bundleSlug;
      if (dossierState && dossierState.run.bundleSlug === slugToCheck) {
        effectiveBundleSlug = dossierState.run.bundleSlug;
        rail = {
          bundleName: dossierState.run.bundleName,
          bundleSlug: dossierState.run.bundleSlug,
          runId: dossierState.run.id,
          model: buildDemarcheRailModel({
            items: dossierState.items,
            completedTemplateIds: dossierState.completedTemplateIds,
            payloads: dossierState.payloads,
            applicableSlugs: dossierState.applicableSlugs,
            hasEligibilityQuestions: dossierState.hasEligibilityQuestions,
            eligibilityCompleted: dossierState.eligibilityCompleted,
          }),
        };
      }
    }
  }

  // Précédence de fusion : le profil est la BASE, le contexte bundle ÉCRASE
  // (plus contextuel — l'utilisateur vient de saisir ces valeurs dans le
  // dossier en cours). On garde le nom de prop `bundlePrefill` pour le layout.
  const mergedPrefill: PrefillMap | undefined =
    profilePrefill || bundlePrefill
      ? { ...profilePrefill, ...bundlePrefill }
      : undefined;

  // Champs hérités du dossier (identité et adresse d'un compagnon, reprises du
  // C1) : on ne les pose pas une seconde fois à l'écran QUAND le dossier les a
  // vraiment fournis. Décidé ici, jamais en base — hors dossier ce même
  // formulaire garde son étape d'identité, faute de quoi le PDF officiel
  // partirait sans nom (cf. `dossier-inheritance.ts`). `bundlePrefill` et non
  // `mergedPrefill` : le profil, lui, ne suffit pas à masquer.
  const runnerForm = {
    ...form,
    fields: applyDossierInheritance(form.fields, bundlePrefill, draftValues),
  };

  // Si le PDF est ouvert dans le contexte d'un dossier codé, on alimente
  // l'illustration animée avec les "types" déclarés par le dossier (ex. les
  // 7 motifs de chômage temporaire). Sinon : illustration sans cycle.
  // `effectiveBundleSlug` (et non `bundleSlug` brut) : couvre aussi le cas
  // où le slug n'était pas dans l'URL mais a été dérivé du run.
  const dossier = effectiveBundleSlug ? getDossier(effectiveBundleSlug) : null;
  const dossierTypes = dossier?.types;

  // Infos importantes contextuelles (panneau d'aide de gauche) : DB sur défauts,
  // résilient (jamais de throw). Passé jusqu'au ContextHelpPanel via le runner.
  const contextTips = await getFormContextTips(form.slug);

  return (
    <div className="flex w-full flex-col gap-4">
      <DocumentPageLayout
        form={runnerForm}
        bundlePrefill={mergedPrefill}
        bundleRunId={validBundleRunId}
        bundleSlug={effectiveBundleSlug}
        rail={rail}
        dossierTypes={dossierTypes}
        contextTips={contextTips}
        initialStepId={initialStepId}
        draftValues={draftValues}
        isAuthenticated={Boolean(userId)}
      />
    </div>
  );
}
