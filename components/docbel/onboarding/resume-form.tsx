"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isValidResumeCodeFormat,
  normalizeResumeCode,
} from "@/lib/bundles/resume-code";
import { GLASS_INPUT, GLASS_LABEL } from "@/lib/glass-classes";

export function ResumeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = normalizeResumeCode(code);
  const formatLooksValid = code.length === 0 || isValidResumeCodeFormat(normalized);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const finalCode = normalizeResumeCode(code);

    if (!isValidResumeCodeFormat(finalCode)) {
      setError("Le code doit être au format BELDOC-XXXX-XXXX.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/bundles/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: finalCode }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 410) {
          setError(
            "Ce code a expiré. Les données associées ont été supprimées. Recommencez un nouveau dossier."
          );
        } else if (res.status === 404) {
          setError("Aucun dossier trouvé pour ce code. Vérifiez la saisie.");
        } else if (res.status === 429) {
          setError(
            "Trop de tentatives. Patientez quelques minutes avant de réessayer."
          );
        } else {
          setError(data.error || "Impossible de reprendre ce dossier.");
        }
        return;
      }
      const data = (await res.json()) as { bundleSlug: string; bundleName: string };
      toast.success(`Reprise du dossier « ${data.bundleName} »`);
      router.push(`/outils/bundles/${data.bundleSlug}`);
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
      <form
        onSubmit={handleSubmit}
        className="glass-surface flex flex-col gap-4 rounded-3xl p-6"
      >
        <div className="flex items-center gap-2 text-[color:var(--glass-ink)]">
          <KeyRound className="size-5" />
          <h2 className="text-lg font-semibold">J&apos;ai un code de reprise</h2>
        </div>
        <p className="text-[13px] text-[color:var(--glass-ink-soft)]">
          Le code a été affiché lors du démarrage du dossier et peut avoir été envoyé
          par email à votre demande. Il ressemble à <code>BELDOC-A1B2-C3D4</code>.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="resume-code" className={GLASS_LABEL}>
            Code de reprise
          </Label>
          <Input
            id="resume-code"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setError(null);
            }}
            placeholder="BELDOC-XXXX-XXXX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className={`${GLASS_INPUT} h-12 font-mono text-base tracking-[0.12em] uppercase`}
            aria-invalid={!formatLooksValid}
            aria-describedby={error ? "resume-error" : undefined}
          />
          {!formatLooksValid && !error && (
            <p className="text-xs text-amber-700">
              Format attendu : BELDOC suivi de deux groupes de 4 caractères.
            </p>
          )}
          {error && (
            <p id="resume-error" className="text-xs text-red-700">
              {error}
            </p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={loading || !isValidResumeCodeFormat(normalized)}
          className="h-12 w-full text-base"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Recherche…
            </>
          ) : (
            <>
              Reprendre
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </form>

      <div
        className="hidden lg:flex lg:flex-col lg:items-center lg:justify-center lg:gap-3 lg:pt-12 text-[color:var(--glass-ink-faint)]"
        aria-hidden="true"
      >
        <div className="h-12 w-px bg-[color:var(--glass-border)]" />
        <span className="rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em]">
          ou
        </span>
        <div className="h-12 w-px bg-[color:var(--glass-border)]" />
      </div>

      <div className="glass-surface flex flex-col gap-4 rounded-3xl p-6">
        <h2 className="text-lg font-semibold text-[color:var(--glass-ink)]">
          Je n&apos;ai pas (encore) de code
        </h2>
        <p className="text-[13px] text-[color:var(--glass-ink-soft)]">
          Pas de souci — démarrez un nouveau dossier depuis la page d&apos;accueil
          de l&apos;onboarding. Un code de reprise vous sera proposé dès le premier
          enregistrement.
        </p>
        <Button
          render={<Link href="/creer-ma-demande" />}
          variant="outline"
          size="lg"
          className="h-12 w-full text-base"
        >
          Démarrer un dossier
          <ArrowRight className="size-4" />
        </Button>
        <p className="text-[11px] text-[color:var(--glass-ink-faint)] italic">
          Aucune donnée nominative n&apos;est conservée. Le code expire au bout
          de 30 jours sans activité, et les données saisies sont supprimées.
        </p>
      </div>
    </div>
  );
}
