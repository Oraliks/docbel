import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { ChevronRightIcon, SparklesIcon } from "lucide-react";
import type { Metadata } from "next";
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

export const dynamic = "force-dynamic";

type LoadFormResult =
  | { kind: "missing" }
  | { kind: "disabled"; title: string; disabledMessage: string | null }
  | {
      kind: "ok";
      form: ReturnType<typeof toPublicForm> & { allowDoccle: boolean; allowItsme: boolean };
    };

async function loadForm(slug: string): Promise<LoadFormResult> {
  const form = await prisma.pdfForm.findUnique({ where: { slug } });
  if (!form || form.status !== "published") return { kind: "missing" };
  if (form.active === false) {
    return { kind: "disabled", title: form.title, disabledMessage: form.disabledMessage };
  }
  const pub = toPublicForm(form);
  return {
    kind: "ok",
    form: {
      ...pub,
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
): Promise<{ shared: SharedBundleValues; runValid: boolean }> {
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
  if (!run || run.status !== "in_progress") return { shared: {}, runValid: false };

  const payloads = (run.payloads as Record<string, Record<string, unknown>>) || {};
  // On collecte les valeurs partagées de tous les PDFs DÉJÀ complétés (qui ne
  // sont PAS le courant — sinon on annule notre propre saisie en cours).
  const sharedMaps: SharedBundleValues[] = [];
  for (const item of run.bundle.items) {
    if (!item.pdfForm || item.pdfForm.id === currentFormId) continue;
    const payload = payloads[item.pdfForm.id];
    if (!payload) continue;
    const fields = (item.pdfForm.fields as unknown as PdfFormField[]) || [];
    sharedMaps.push(extractSharedValues(fields, payload));
  }
  return { shared: mergeSharedValues(...sharedMaps), runValid: true };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const res = await loadForm(slug);
  if (res.kind === "missing") return { title: "Formulaire indisponible" };
  if (res.kind === "disabled") return { title: `${res.title} — indisponible` };
  return { title: `${res.form.title} — DocBel`, description: res.form.description ?? undefined };
}

export default async function PdfFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ bundleRun?: string; bundleSlug?: string }>;
}) {
  const { slug } = await params;
  const { bundleRun, bundleSlug } = await searchParams;
  const res = await loadForm(slug);
  if (res.kind === "missing") notFound();
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
  // et on les injecte comme valeurs par défaut dans ce PDF.
  let bundlePrefill: Record<string, string> | undefined;
  let validBundleRunId: string | undefined;
  if (bundleRun) {
    const { shared, runValid } = await loadBundleSharedValues(bundleRun, form.id);
    if (runValid) {
      validBundleRunId = bundleRun;
      bundlePrefill = applySharedValuesToForm(form.fields, shared);
    }
  }

  // Précédence de fusion : le profil est la BASE, le contexte bundle ÉCRASE
  // (plus contextuel — l'utilisateur vient de saisir ces valeurs dans le
  // dossier en cours). On garde le nom de prop `bundlePrefill` pour le layout.
  const mergedPrefill: Record<string, string> | undefined =
    profilePrefill || bundlePrefill
      ? { ...profilePrefill, ...bundlePrefill }
      : undefined;

  // Si le PDF est ouvert dans le contexte d'un dossier codé, on alimente
  // l'illustration animée avec les "types" déclarés par le dossier (ex. les
  // 7 motifs de chômage temporaire). Sinon : illustration sans cycle.
  const dossier = bundleSlug ? getDossier(bundleSlug) : null;
  const dossierTypes = dossier?.types;

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
              Complète ton profil
            </span>{" "}
            pour préremplir tes documents automatiquement.
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
      />
    </div>
  );
}
