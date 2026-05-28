import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { toPublicForm } from "@/lib/pdf-forms/public-serializer";
import { isDoccleConfigured } from "@/lib/pdf-forms/integrations/doccle";
import { isItsmeConfigured } from "@/lib/pdf-forms/integrations/itsme";
import { PdfFormRunner } from "@/components/pdf-forms/pdf-form-runner";

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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const form = await loadForm(slug);
  if (!form) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <header className="mb-6 flex flex-col gap-1">
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

      <PdfFormRunner form={form} />
    </main>
  );
}
