import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { toPublicForm } from "@/lib/pdf-forms/public-serializer";
import { isDoccleConfigured } from "@/lib/pdf-forms/integrations/doccle";
import { isItsmeConfigured } from "@/lib/pdf-forms/integrations/itsme";
import { PdfFormRunner } from "@/components/pdf-forms/pdf-form-runner";
import type { PdfFormField } from "@/lib/pdf-forms/types";
import {
  applySharedValuesToForm,
  extractSharedValues,
  mergeSharedValues,
  type SharedBundleValues,
} from "@/lib/bundles/shared-values";

export const dynamic = "force-dynamic";

async function loadForm(slug: string) {
  const form = await prisma.pdfForm.findUnique({ where: { slug } });
  if (!form || form.status !== "published") return null;
  const pub = toPublicForm(form);
  return {
    ...pub,
    allowDoccle: pub.allowDoccle && isDoccleConfigured(),
    allowItsme: pub.allowItsme && isItsmeConfigured(),
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
  const form = await loadForm(slug);
  if (!form) return { title: "Formulaire indisponible" };
  return { title: `${form.title} — DocBel`, description: form.description ?? undefined };
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
  const form = await loadForm(slug);
  if (!form) notFound();

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

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <header className="mb-6 flex flex-col gap-1">
        {bundleSlug && (
          <a
            href={`/outils/bundles/${bundleSlug}`}
            className="text-xs text-muted-foreground hover:underline"
          >
            ← Retour au dossier
          </a>
        )}
        {form.issuer && (
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {form.issuer}
          </span>
        )}
        <h1 className="text-xl font-semibold sm:text-2xl">{form.title}</h1>
        {form.description && (
          <p className="text-sm text-muted-foreground">{form.description}</p>
        )}
      </header>

      <PdfFormRunner form={form} bundlePrefill={bundlePrefill} bundleRunId={validBundleRunId} />
    </main>
  );
}
