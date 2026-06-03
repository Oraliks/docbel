"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  AlertCircleIcon,
  ArrowRightIcon,
  Building2Icon,
  CheckCircle2Icon,
  Loader2Icon,
  MailCheckIcon,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GLASS_CARD,
  GLASS_INPUT,
  GLASS_LABEL,
  GLASS_PRIMARY_STYLE,
} from "@/lib/glass-classes";
import { isValidBelgianTVA } from "@/lib/documents/validators";

export type ExpectedSegment = "partenaire" | "employeur";

type FormState = {
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
  vatNumber: string;
};

const INITIAL: FormState = {
  name: "",
  email: "",
  password: "",
  passwordConfirm: "",
  vatNumber: "",
};

type LookupResult = {
  emailQueried: string;
  recognized: boolean;
  organizationName?: string;
  isTest?: boolean;
  segment?: string;
  partnerType?: string | null;
};

type LookupState =
  | { status: "idle" }
  | { status: "checking" }
  | {
      status: "recognized";
      organizationName: string;
      isTest: boolean;
      segment: string;
      partnerType: string | null;
    }
  // L'email est reconnu dans l'allowlist mais pour l'AUTRE segment :
  // on ne propose pas l'inscription ici, on renvoie vers la bonne page.
  | {
      status: "mismatch";
      organizationName: string;
      segment: string;
    }
  | { status: "unknown" };

/**
 * Copie et cibles dépendantes du segment attendu par la page hôte. Le segment
 * réel reste posé côté serveur depuis l'allowlist — ici on ne fait qu'adapter
 * les libellés et savoir vers quelle autre page renvoyer en cas de mismatch.
 */
const SEGMENT_COPY: Record<
  ExpectedSegment,
  {
    recognizedLabel: string;
    emailPlaceholder: string;
    submitLabel: string;
    submitPendingLabel: string;
    unknownDomain: string;
  }
> = {
  partenaire: {
    recognizedLabel: "Espace partenaire",
    emailPlaceholder: "prenom.nom@cpas.brussels",
    submitLabel: "Créer mon compte partenaire",
    submitPendingLabel: "Envoi…",
    unknownDomain:
      "Ce domaine n'est pas autorisé pour l'espace partenaire. Contactez DocBel pour référencer votre organisation (CPAS, syndicat, mutuelle…).",
  },
  employeur: {
    recognizedLabel: "Espace employeur",
    emailPlaceholder: "prenom.nom@votre-entreprise.be",
    submitLabel: "Créer mon compte employeur",
    submitPendingLabel: "Envoi…",
    unknownDomain:
      "Ce domaine n'est pas encore autorisé pour l'espace employeur. Contactez DocBel pour activer votre entreprise.",
  },
};

const OTHER_SEGMENT: Record<
  ExpectedSegment,
  { label: string; href: string }
> = {
  partenaire: { label: "espace employeur", href: "/inscription/employeur" },
  employeur: { label: "espace partenaire", href: "/inscription/partenaire" },
};

function isLookupCandidate(email: string): boolean {
  if (!email.includes("@")) return false;
  const domain = email.split("@")[1];
  return Boolean(domain && domain.includes("."));
}

export function SignupForm({
  expectedSegment,
  framed = true,
  onSwitchSegment,
}: {
  expectedSegment: ExpectedSegment;
  /** false = rend le <form> nu (sans la Card), pour l'embarquer dans un layout. */
  framed?: boolean;
  /** Si fourni, le bandeau "mismatch" bascule le segment ici au lieu de naviguer. */
  onSwitchSegment?: (segment: ExpectedSegment) => void;
}) {
  const copy = SEGMENT_COPY[expectedSegment];
  const other = OTHER_SEGMENT[expectedSegment];
  const otherSegment: ExpectedSegment =
    expectedSegment === "partenaire" ? "employeur" : "partenaire";

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
      : !lookupResult.recognized
        ? { status: "unknown" }
        : (lookupResult.segment ?? "partenaire") !== expectedSegment
          ? {
              status: "mismatch",
              organizationName: lookupResult.organizationName ?? "",
              segment: lookupResult.segment ?? "partenaire",
            }
          : {
              status: "recognized",
              organizationName: lookupResult.organizationName ?? "",
              isTest: lookupResult.isTest ?? false,
              segment: lookupResult.segment ?? "partenaire",
              partnerType: lookupResult.partnerType ?? null,
            };

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
          segment: data.segment,
          partnerType: data.partnerType,
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
    if (lookup.status === "mismatch") {
      setError(
        `Cette adresse correspond à un ${other.label}. Inscrivez-vous sur la page dédiée.`,
      );
      return;
    }
    if (lookup.status !== "recognized") {
      setError(copy.unknownDomain);
      return;
    }
    if (expectedSegment === "employeur" && !isValidBelgianTVA(form.vatNumber)) {
      setError(
        "Numéro de TVA belge invalide (format attendu : BE0123456789).",
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
            vatNumber: form.vatNumber,
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

  // Le submit n'est actif que si le domaine est reconnu ET appartient au
  // segment attendu par cette page (garde anti-mismatch côté client).
  const submitDisabled =
    isPending ||
    lookup.status !== "recognized" ||
    (expectedSegment === "employeur" && !form.vatNumber.trim());

  const formInner = (
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
              placeholder={copy.emailPlaceholder}
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
                  <p className="opacity-80">{copy.recognizedLabel} — organisation reconnue.</p>
                </div>
              </div>
            ) : null}

            {lookup.status === "mismatch" ? (
              <div
                className="flex items-start gap-2 rounded-2xl p-3 text-[12.5px]"
                style={{
                  background: "rgba(255, 200, 140, 0.18)",
                  color: "#8a4f0a",
                }}
              >
                <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
                <div className="flex-1">
                  <p>
                    Cette adresse correspond à un{" "}
                    <strong>{other.label}</strong>
                    {lookup.organizationName
                      ? ` (${lookup.organizationName})`
                      : ""}
                    .
                  </p>
                  {onSwitchSegment ? (
                    <button
                      type="button"
                      onClick={() => onSwitchSegment(otherSegment)}
                      className="mt-1 inline-flex items-center gap-1 font-bold underline underline-offset-2"
                    >
                      Passer à l&apos;{other.label}
                      <ArrowRightIcon className="size-3.5" />
                    </button>
                  ) : (
                    <Link
                      href={other.href}
                      className="mt-1 inline-flex items-center gap-1 font-bold underline underline-offset-2"
                    >
                      Inscrivez-vous ici
                      <ArrowRightIcon className="size-3.5" />
                    </Link>
                  )}
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
                <div className="flex-1">{copy.unknownDomain}</div>
              </div>
            ) : null}
          </div>

          {expectedSegment === "employeur" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vatNumber" className={GLASS_LABEL}>
                Numéro de TVA
              </Label>
              <Input
                id="vatNumber"
                required
                autoComplete="off"
                placeholder="BE0123456789"
                value={form.vatNumber}
                onChange={handleChange("vatNumber")}
                className={GLASS_INPUT}
              />
              <p className="text-[11.5px] text-[color:var(--glass-ink-faint)]">
                TVA belge de votre entreprise — validée (checksum) et unique par
                compte.
              </p>
            </div>
          ) : null}

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
              style={GLASS_PRIMARY_STYLE}
            >
              {isPending ? copy.submitPendingLabel : copy.submitLabel}
              {!isPending ? <CheckCircle2Icon className="size-4" /> : null}
            </Button>
          </div>
        </form>
  );

  if (!framed) return formInner;
  return (
    <Card className={GLASS_CARD}>
      <CardContent className="p-7 sm:p-8">{formInner}</CardContent>
    </Card>
  );
}

/**
 * Alias rétro-compatible. Conserve l'API historique `<PartnerSignupForm />`
 * (segment partenaire par défaut) tout en exposant le composant neutre
 * `SignupForm` pour les nouvelles pages segmentées.
 */
export function PartnerSignupForm() {
  return <SignupForm expectedSegment="partenaire" />;
}
