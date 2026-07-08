import { notFound, permanentRedirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { ChevronRightIcon, SparklesIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toPublicForm } from "@/lib/pdf-forms/public-serializer";
import { isDoccleConfigured } from "@/lib/pdf-forms/integrations/doccle";
import { isItsmeConfigured } from "@/lib/pdf-forms/integrations/itsme";
import { DocumentPageLayout } from "@/components/pdf-forms/document-page-layout";
import { DisabledFormView } from "./disabled-form-view";
import { getDossier } from "@/lib/dossiers/registry";
import type { PdfFormField } from "@/lib/pdf-forms/types";
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
  currentFormId: string
): Promise<{ shared: SharedBundleValues; canonical: CanonicalMap; runValid: boolean }> {
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
    return { shared: {}, canonical: {}, runValid: false };
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
  return {
    shared: mergeSharedValues(...sharedMaps),
    canonical: mergeCanonical(...canonicalMaps),
    runValid: true,
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
  const t = await getTranslations("public.contenu");
  const { bundleRun, bundleSlug } = await searchParams;
  const res = await loadForm(path);
  if (res.kind === "missing") notFound();
  if (res.kind === "redirect") permanentRedirect(`/document/${res.publicPath}`);
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
  // Profil « essentiellement vide » → on incite à le compléter (cf. bannière).
  let profileEmpty = false;
  if (userId) {
    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    if (profile) {
      profilePrefill = buildProfilePrefill(form.fields, profile);
    }
    // Sans NISS ni nom, le prefill ne sert quasiment à rien : on nudge.
    profileEmpty = !profile || (!profile.niss && !profile.lastName);
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
  if (bundleRun) {
    const { shared, canonical, runValid } = await loadBundleSharedValues(bundleRun, form.id);
    if (runValid) {
      validBundleRunId = bundleRun;
      const bySharedFrom = applySharedValuesToForm(form.fields, shared);
      const byCanonical = canonicalToPrefill(form.fields, canonical);
      // `byCanonical` peut contenir des `FullNameValue` (composite prénom+nom
      // pour un champ `type: "fullname"`), `bySharedFrom` uniquement des
      // strings. Priorité `prefillFrom` (précision plus fine, contexte plus
      // certain que la composition canonique) — donc bySharedFrom prime.
      bundlePrefill = { ...byCanonical, ...bySharedFrom };
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

  // Nudge profil : connecté mais profil quasi vide → invite à le compléter
  // pour bénéficier du préremplissage automatique. Aucune bannière si le profil
  // est renseigné (le prefill fait alors son office silencieusement).
  const showProfileNudge = Boolean(userId) && profileEmpty;

  return (
    <div className="flex w-full flex-col gap-4">
      {showProfileNudge && (
        <Link
          href="/profil"
          className="glass-surface flex items-center gap-3 rounded-2xl px-4 py-3 text-[13px] transition-colors hover:bg-[color:var(--glass-pop-bg)]/40"
          style={{ color: "var(--glass-ink-soft)" }}
        >
          <SparklesIcon
            className="size-4 shrink-0"
            style={{ color: "var(--glass-accent-deep)" }}
          />
          <span>
            <span className="font-semibold text-[color:var(--glass-ink)]">
              {t("profileNudgeTitle")}
            </span>{" "}
            {t("profileNudgeText")}
          </span>
          <ChevronRightIcon className="ml-auto size-4 shrink-0 text-[color:var(--glass-accent-deep)]" />
        </Link>
      )}
      <DocumentPageLayout
        form={form}
        bundlePrefill={mergedPrefill}
        bundleRunId={validBundleRunId}
        bundleSlug={bundleSlug}
        dossierTypes={dossierTypes}
        legacyLayout={legacyLayout}
      />
    </div>
  );
}
