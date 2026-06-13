import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContractBuilder } from "@/components/docbel/employeur/contracts/contract-builder";
import { getEmployerPageUser } from "@/lib/employeur/page-auth";
import { getProfileForUser } from "@/lib/employeur/queries";
import { prisma } from "@/lib/prisma";
import { CONTRACT_SOURCES } from "@/lib/employeur/contracts/legal-content";

export const metadata: Metadata = {
  title: "Générer un contrat | Espace Employeur",
};

export const dynamic = "force-dynamic";

export default async function ContratsPage() {
  const user = await getEmployerPageUser();
  if (!user) redirect("/p/employeur");

  const [profile, account] = await Promise.all([
    getProfileForUser(user.id),
    prisma.user.findUnique({ where: { id: user.id }, select: { vatNumber: true } }),
  ]);

  // Mappe les données employeur vers les ids de champs du moteur de contrat.
  const initialValues: Record<string, string> = {};
  const put = (key: string, value: string | null | undefined) => {
    if (value != null && value !== "") initialValues[key] = value;
  };
  put("employer_name", profile?.organisationName);
  put("employer_legal_form", profile?.legalForm);
  put("employer_bce", profile?.enterpriseNumber);
  put("employer_onss", profile?.onssNumber);
  put("employer_joint_committee", profile?.jointCommitteeNumber);
  put("employer_vat", account?.vatNumber);

  return (
    <div className="flex w-full flex-col gap-5 p-4 sm:p-6 lg:px-8 duration-500 animate-in fade-in">
      <Button variant="ghost" size="sm" render={<Link href="/employeur" />}>
        <ArrowLeft /> Tableau de bord
      </Button>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Générer un contrat</h1>
        <p className="text-muted-foreground">
          Composez un modèle de contrat de travail belge : choisissez le type et le régime,
          adaptez les clauses, complétez les informations et obtenez un aperçu prêt à relire,
          copier, télécharger ou imprimer.
        </p>
      </header>

      <ContractBuilder initialValues={initialValues} />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Sources officielles</h2>
        <ul className="space-y-1.5 text-sm">
          {CONTRACT_SOURCES.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
              >
                <ExternalLink className="size-3.5 shrink-0" />
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
