import type { Metadata } from "next";
import { ResumeForm } from "@/components/docbel/onboarding/resume-form";

export const metadata: Metadata = {
  title: "Reprendre un dossier — beldoc",
  description:
    "Reprenez votre dossier en cours en saisissant le code de reprise reçu lors de sa création.",
};

export default function ReprendrePage() {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 px-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
          Reprise de dossier
        </p>
        <h1 className="glass-display text-[40px] font-semibold leading-[1.05] sm:text-[48px]">
          Reprenez votre dossier <em>là où vous l&apos;avez laissé.</em>
        </h1>
        <p className="max-w-2xl text-[14px] text-[color:var(--glass-ink-soft)]">
          Si vous avez commencé un dossier sur cet appareil, il reprend automatiquement.
          Si vous changez d&apos;ordinateur ou que vous avez effacé vos cookies, saisissez
          ci-dessous le code de reprise reçu lors du démarrage du dossier.
        </p>
      </header>

      <ResumeForm />
    </section>
  );
}
