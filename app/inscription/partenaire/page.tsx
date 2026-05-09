import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { PartnerSignupForm } from "@/components/docbel/partner-signup-form";

export const metadata: Metadata = {
  title: "Inscription partenaire | DocBel",
  description:
    "Inscrivez votre organisation (CPAS, syndicat, mutuelle) à l'espace partenaire DocBel.",
};

export default async function PartnerSignupRoute() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  if (session?.user) {
    redirect("/partenaire");
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 py-6">
      <div className="space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">
          Espace Partenaire
        </span>
        <h1 className="text-3xl font-bold tracking-tight">
          Inscription partenaire
        </h1>
        <p className="text-sm text-muted-foreground">
          L&apos;inscription est réservée aux adresses email professionnelles
          autorisées (ex : <code>@cpas.brussels</code>). Si votre organisation
          n&apos;est pas encore référencée, contactez-nous.
        </p>
      </div>
      <PartnerSignupForm />
    </div>
  );
}
