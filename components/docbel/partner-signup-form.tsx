"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  AlertCircleIcon,
  Building2Icon,
  CheckCircle2Icon,
  Loader2Icon,
  MailCheckIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GLASS_CARD,
  GLASS_INPUT,
  GLASS_LABEL,
} from "@/lib/glass-classes";

type FormState = {
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
};

const INITIAL: FormState = {
  name: "",
  email: "",
  password: "",
  passwordConfirm: "",
};

type LookupResult = {
  emailQueried: string;
  recognized: boolean;
  organizationName?: string;
  isTest?: boolean;
};

type LookupState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "recognized"; organizationName: string; isTest: boolean }
  | { status: "unknown" };

function isLookupCandidate(email: string): boolean {
  if (!email.includes("@")) return false;
  const domain = email.split("@")[1];
  return Boolean(domain && domain.includes("."));
}

export function PartnerSignupForm() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ email: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const lookupSeqRef = useRef(0);

  const normalizedEmail = form.email.trim().toLowerCase();
  const lookupEligible = isLookupCandidate(normalizedEmail);

  const lookup: LookupState = !lookupEligible
    ? { status: "idle" }
    : lookupResult?.emailQueried !== normalizedEmail
      ? { status: "checking" }
      : lookupResult.recognized
        ? {
            status: "recognized",
            organizationName: lookupResult.organizationName ?? "",
            isTest: lookupResult.isTest ?? false,
          }
        : { status: "unknown" };

  useEffect(() => {
    if (!lookupEligible) return;

    const seq = ++lookupSeqRef.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/inscription/lookup-domain?email=${encodeURIComponent(normalizedEmail)}`,
        );
        if (seq !== lookupSeqRef.current) return;
        if (!res.ok) {
          setLookupResult({
            emailQueried: normalizedEmail,
            recognized: false,
          });
          return;
        }
        const data = await res.json();
        setLookupResult({
          emailQueried: normalizedEmail,
          recognized: Boolean(data.recognized),
          organizationName: data.organizationName,
          isTest: data.isTest,
        });
      } catch {
        if (seq !== lookupSeqRef.current) return;
        setLookupResult({ emailQueried: normalizedEmail, recognized: false });
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [normalizedEmail, lookupEligible]);

  const handleChange =
    (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.passwordConfirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (form.password.length < 8) {
      setError("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    if (lookup.status !== "recognized") {
      setError(
        "Le domaine de votre email n'est pas reconnu. Contactez DocBel pour autoriser votre organisation.",
      );
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/inscription/partenaire", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            password: form.password,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Une erreur est survenue.");
          return;
        }
        setSuccess({ email: form.email });
      } catch (err) {
        console.error(err);
        setError("Erreur réseau. Réessayez dans un instant.");
      }
    });
  };

  if (success) {
    return (
      <Card className={GLASS_CARD}>
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <span
            className="flex size-14 items-center justify-center rounded-2xl text-white"
            style={{
              backgroundImage:
                "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-deep))",
            }}
          >
            <MailCheckIcon className="size-6" />
          </span>
          <h2 className="glass-display text-[24px] font-semibold">
            Vérifiez votre boîte mail
          </h2>
          <p className="max-w-md text-[13.5px] text-[color:var(--glass-ink-soft)]">
            Un email a été envoyé à <strong>{success.email}</strong> avec un
            lien d&apos;activation valable 24 heures.
          </p>
          <p className="text-[12px] text-[color:var(--glass-ink-faint)]">
            Pas d&apos;email reçu ? Vérifiez vos spams ou contactez-nous.
          </p>
        </CardContent>
      </Card>
    );
  }

  const submitDisabled = isPending || lookup.status !== "recognized";

  return (
    <Card className={GLASS_CARD}>
      <CardContent className="p-7 sm:p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name" className={GLASS_LABEL}>
              Votre nom
            </Label>
            <Input
              id="name"
              autoComplete="name"
              required
              value={form.name}
              onChange={handleChange("name")}
              className={GLASS_INPUT}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email" className={GLASS_LABEL}>
              Email professionnel
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="prenom.nom@cpas.brussels"
              value={form.email}
              onChange={handleChange("email")}
              className={GLASS_INPUT}
            />

            {lookup.status === "checking" ? (
              <p className="flex items-center gap-1.5 text-[12px] text-[color:var(--glass-ink-soft)]">
                <Loader2Icon className="size-3 animate-spin" />
                Vérification du domaine…
              </p>
            ) : null}

            {lookup.status === "recognized" ? (
              <div
                className="flex items-start gap-2 rounded-2xl p-3 text-[12.5px]"
                style={{
                  background: "rgba(80, 200, 140, 0.12)",
                  color: "#1d6b3e",
                }}
              >
                <CheckCircle2Icon className="mt-0.5 size-4 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Building2Icon className="size-3.5" />
                    {lookup.organizationName}
                    {lookup.isTest ? (
                      <span
                        className="ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase"
                        style={{
                          background: "rgba(255, 200, 140, 0.40)",
                          color: "#8a4f0a",
                        }}
                      >
                        Test
                      </span>
                    ) : null}
                  </div>
                  <p className="opacity-80">Organisation reconnue.</p>
                </div>
              </div>
            ) : null}

            {lookup.status === "unknown" && form.email.includes("@") ? (
              <div
                className="flex items-start gap-2 rounded-2xl p-3 text-[12.5px]"
                style={{
                  background: "rgba(255, 200, 140, 0.18)",
                  color: "#8a4f0a",
                }}
              >
                <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
                <div className="flex-1">
                  Ce domaine n&apos;est pas autorisé. Contactez DocBel pour
                  ajouter votre organisation.
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className={GLASS_LABEL}>
                Mot de passe
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={form.password}
                onChange={handleChange("password")}
                className={GLASS_INPUT}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="passwordConfirm" className={GLASS_LABEL}>
                Confirmation
              </Label>
              <Input
                id="passwordConfirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={form.passwordConfirm}
                onChange={handleChange("passwordConfirm")}
                className={GLASS_INPUT}
              />
            </div>
          </div>

          {error ? (
            <div
              className="flex items-start gap-2 rounded-2xl p-3 text-[13px]"
              style={{
                background: "rgba(220, 80, 100, 0.12)",
                color: "#b8324a",
              }}
            >
              <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
              {error}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] text-[color:var(--glass-ink-faint)]">
              En vous inscrivant, vous acceptez les conditions d&apos;utilisation
              de DocBel.
            </p>
            <Button
              type="submit"
              disabled={submitDisabled}
              className="rounded-full px-5 py-3 text-[13px] font-bold disabled:opacity-50"
              style={{
                background: "var(--glass-ink)",
                color: "var(--glass-bg-a)",
              }}
            >
              {isPending ? "Envoi…" : "Créer mon compte"}
              {!isPending ? <CheckCircle2Icon className="size-4" /> : null}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
