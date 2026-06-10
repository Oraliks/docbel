import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { toPublicForm } from "@/lib/pdf-forms/public-serializer";
import { isDoccleConfigured } from "@/lib/pdf-forms/integrations/doccle";
import { isItsmeConfigured } from "@/lib/pdf-forms/integrations/itsme";
import { DocumentPageLayout } from "@/components/pdf-forms/document-page-layout";
import { DisabledFormView } from "./disabled-form-view";
import { getDossier } from "@/lib/dossiers/registry";
import type { PdfFormField } from "@/lib/pdf-forms/types";
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
      <div className="mx-auto w-full max-w-5xl p-4 lg:p-6">
        <DisabledFormView formTitle={res.title} customMessage={res.disabledMessage} />
      </div>
    );
  }
  const form = res.form;

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

  // Si le PDF est ouvert dans le contexte d'un dossier codé, on alimente
  // l'illustration animée avec les "types" déclarés par le dossier (ex. les
  // 7 motifs de chômage temporaire). Sinon : illustration sans cycle.
  const dossier = bundleSlug ? getDossier(bundleSlug) : null;
  const dossierTypes = dossier?.types;

  return (
    <DocumentPageLayout
      form={form}
      bundlePrefill={bundlePrefill}
      bundleRunId={validBundleRunId}
      bundleSlug={bundleSlug}
      dossierTypes={dossierTypes}
    />
  );
}
