"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  CheckCircle2Icon,
  Building2Icon,
  Loader2Icon,
  MailCheckIcon,
  AlertCircleIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
          setLookupResult({ emailQueried: normalizedEmail, recognized: false });
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
      <Card>
        <CardHeader>
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">
            <MailCheckIcon className="size-6" />
          </div>
          <CardTitle className="text-center">
            Vérifiez votre boîte mail
          </CardTitle>
          <CardDescription className="text-center">
            Un email a été envoyé à <strong>{success.email}</strong> avec un
            lien d&apos;activation valable 24 heures.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-xs text-muted-foreground">
            Pas d&apos;email reçu ? Vérifiez vos spams ou contactez-nous.
          </p>
        </CardContent>
      </Card>
    );
  }

  const submitDisabled = isPending || lookup.status !== "recognized";

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Votre nom</Label>
            <Input
              id="name"
              autoComplete="name"
              required
              value={form.name}
              onChange={handleChange("name")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email professionnel</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="prenom.nom@cpas.brussels"
              value={form.email}
              onChange={handleChange("email")}
            />

            {lookup.status === "checking" && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2Icon className="size-3 animate-spin" />
                Vérification du domaine…
              </p>
            )}
            {lookup.status === "recognized" && (
              <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-2.5 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
                <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-200">
                    <Building2Icon className="size-3.5" />
                    {lookup.organizationName}
                    {lookup.isTest && (
                      <span className="ml-auto rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                        Test
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-emerald-700/80 dark:text-emerald-200/80">
                    Organisation reconnue.
                  </p>
                </div>
              </div>
            )}
            {lookup.status === "unknown" && form.email.includes("@") && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
                <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-300" />
                <div className="flex-1 text-xs text-amber-800 dark:text-amber-200">
                  Ce domaine n&apos;est pas autorisé. Contactez DocBel pour
                  ajouter votre organisation.
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={form.password}
                onChange={handleChange("password")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="passwordConfirm">Confirmation</Label>
              <Input
                id="passwordConfirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={form.passwordConfirm}
                onChange={handleChange("passwordConfirm")}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              En vous inscrivant, vous acceptez les conditions d&apos;utilisation
              de DocBel.
            </p>
            <Button type="submit" disabled={submitDisabled}>
              {isPending ? "Envoi…" : "Créer mon compte"}
              {!isPending && <CheckCircle2Icon className="size-4" />}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
