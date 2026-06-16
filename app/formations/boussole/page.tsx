import type { Metadata } from "next";
import { getBoussoleQuestions, toPublicQuestions } from "@/lib/formations/boussole/load";
import { BoussoleClient } from "./boussole-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Boussole d'orientation — Docbel Formations",
  description:
    "Vous ne savez pas quelle formation choisir ? Répondez à quelques questions simples : Docbel vous aide à identifier les domaines adaptés à votre situation.",
};

export default async function BoussolePage() {
  const questions = toPublicQuestions(await getBoussoleQuestions());
  return <BoussoleClient questions={questions} />;
}
