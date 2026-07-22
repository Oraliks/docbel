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
import { useTranslations } from "next-intl";
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
import { isValidBelgianTVA } from "@/lib/pdf-forms/validators";

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

type SignupT = ReturnType<typeof useTranslations<"public.auth">>;

type SegmentCopy = {
  recognizedLabel: string;
  emailPlaceholder: string;
  submitLabel: string;
  submitPendingLabel: string;
  unknownDomain: string;
};

/**
 * Copie et cibles dépendantes du segment attendu par la page hôte. Le segment
 * réel reste posé côté serveur depuis l'allowlist — ici on ne fait qu'adapter
 * les libellés et savoir vers quelle autre page renvoyer en cas de mismatch.
 */
function getSegmentCopy(t: SignupT): Record<ExpectedSegment, SegmentCopy> {
  return {
    partenaire: {
      recognizedLabel: t("signupPartnerRecognizedLabel"),
      emailPlaceholder: t("signupPartnerEmailPlaceholder"),
      submitLabel: t("signupPartnerSubmit"),
      submitPendingLabel: t("signupSubmitPending"),
      unknownDomain: t("signupPartnerUnknownDomain"),
    },
    employeur: {
      recognizedLabel: t("signupEmployerRecognizedLabel"),
      emailPlaceholder: t("signupEmployerEmailPlaceholder"),
      submitLabel: t("signupEmployerSubmit"),
      submitPendingLabel: t("signupSubmitPending"),
      unknownDomain: t("signupEmployerUnknownDomain"),
    },
  };
}

const OTHER_SEGMENT: Record<ExpectedSegment, { href: string }> = {
  partenaire: { href: "/inscription/employeur" },
  employeur: { href: "/inscription/partenaire" },
};

function otherSegmentLabel(t: SignupT, segment: ExpectedSegment): string {
  return segment === "partenaire"
    ? t("signupOtherEmployer")
    : t("signupOtherPartner");
}

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
  const t = useTranslations("public.auth");
  const copy = getSegmentCopy(t)[expectedSegment];
  const other = OTHER_SEGMENT[expectedSegment];
  const otherLabel = otherSegmentLabel(t, expectedSegment);
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
      setError(t("errPasswordMismatch"));
      return;
    }
    if (form.password.length < 8) {
      setError(t("errPasswordTooShort"));
      return;
    }
    if (lookup.status === "mismatch") {
      setError(t("errSegmentMismatch", { segment: otherLabel }));
      return;
    }
    if (lookup.status !== "recognized") {
      setError(copy.unknownDomain);
      return;
    }
    if (expectedSegment === "employeur" && !isValidBelgianTVA(form.vatNumber)) {
      setError(t("errInvalidTva"));
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
          setError(data.error || t("errGeneric"));
          return;
        }
        setSuccess({ email: form.email });
      } catch (err) {
        console.error(err);
        setError(t("errNetwork"));
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
            {t("checkInbox")}
          </h2>
          <p className="max-w-md text-[13.5px] text-[color:var(--glass-ink-soft)]">
            {t.rich("signupSentBody", {
              email: success.email,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
          <p className="text-[12px] text-[color:var(--glass-ink-faint)]">
            {t("signupNoEmailReceived")}
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
              {t("signupNameLabel")}
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
              {t("signupEmailLabel")}
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
                {t("signupCheckingDomain")}
              </p>
            ) : null}

            {lookup.status === "recognized" ? (
              <div
                className="flex items-start gap-2 rounded-2xl p-3 text-[12.5px]"
                style={{
                  background: "var(--glass-success-surface)",
                  color: "var(--glass-success-ink)",
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
                          background: "var(--glass-warning-surface)",
                          color: "var(--glass-warning-ink)",
                        }}
                      >
                        {t("signupTestBadge")}
                      </span>
                    ) : null}
                  </div>
                  <p className="opacity-80">{t("signupRecognized", { label: copy.recognizedLabel })}</p>
                </div>
              </div>
            ) : null}

            {lookup.status === "mismatch" ? (
              <div
                className="flex items-start gap-2 rounded-2xl p-3 text-[12.5px]"
                style={{
                  background: "var(--glass-warning-surface)",
                  color: "var(--glass-warning-ink)",
                }}
              >
                <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
                <div className="flex-1">
                  <p>
                    {t.rich("signupMismatchText", {
                      segment: otherLabel,
                      org: lookup.organizationName
                        ? ` (${lookup.organizationName})`
                        : "",
                      strong: (chunks) => <strong>{chunks}</strong>,
                    })}
                  </p>
                  {onSwitchSegment ? (
                    <button
                      type="button"
                      onClick={() => onSwitchSegment(otherSegment)}
                      className="mt-1 inline-flex items-center gap-1 font-bold underline underline-offset-2"
                    >
                      {t("signupSwitchTo", { segment: otherLabel })}
                      <ArrowRightIcon className="size-3.5" />
                    </button>
                  ) : (
                    <Link
                      href={other.href}
                      className="mt-1 inline-flex items-center gap-1 font-bold underline underline-offset-2"
                    >
                      {t("signupSignUpHere")}
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
                  background: "var(--glass-warning-surface)",
                  color: "var(--glass-warning-ink)",
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
                {t("signupVatLabel")}
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
                {t("signupVatHelp")}
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className={GLASS_LABEL}>
                {t("passwordLabel")}
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
                {t("confirmationLabel")}
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
                background: "color-mix(in oklab, var(--destructive) 10%, transparent)",
                color: "var(--destructive)",
              }}
            >
              <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
              {error}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] text-[color:var(--glass-ink-faint)]">
              {t("signupTerms")}
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
