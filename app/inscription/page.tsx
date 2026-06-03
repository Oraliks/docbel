import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { InscriptionSplit } from "@/components/docbel/inscription-split";

export const metadata: Metadata = {
  title: "Inscription | DocBel",
  description:
    "Créez votre compte DocBel — partenaire (CPAS, syndicat, mutuelle, ONEM…) ou employeur.",
};

export default async function InscriptionRoute() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  if (session?.user) redirect("/");

  return <InscriptionSplit />;
}
