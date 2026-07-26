"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  BadgeCheckIcon,
  BuildingIcon,
  CheckCircle2Icon,
  Loader2Icon,
  SendIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react";
import {
  PUBLIC_ORG_TYPES,
  ORG_TYPE_LABELS,
  type FormationOrgType,
} from "@/lib/formations/constants";

interface VerifyState {
  status: "idle" | "checking" | "done";
  verified: boolean;
  checksumValid: boolean;
  legalName: string | null;
  message: string;
}

const EMPTY_VERIFY: VerifyState = {
  status: "idle",
  verified: false,
  checksumValid: false,
  legalName: null,
  message: "",
};

const inputCls =
  "w-full rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3.5 py-2.5 text-[14px] text-[color:var(--glass-ink)] outline-none transition placeholder:text-[color:var(--glass-ink-faint)] focus:border-[color:var(--glass-accent-deep)]";

export function ProposerClient() {
  const [form, setForm] = useState({
    name: "",
    type: "ecole" as FormationOrgType,
    enterpriseNumber: "",
    description: "",
    website: "",
    street: "",
    postalCode: "",
    city: "",
    contactName: "",
    contactRole: "",
    contactEmail: "",
    contactPhone: "",
    password: "",
    acceptTerms: false,
  });
  const [verify, setVerify] = useState<VerifyState>(EMPTY_VERIFY);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function checkBce() {
    const n = form.enterpriseNumber.trim();
    if (!n) return setVerify(EMPTY_VERIFY);
    setVerify({ ...EMPTY_VERIFY, status: "checking" });
    try {
      const r = await fetch(
        `/api/formations/organismes/verify-bce?number=${encodeURIComponent(n)}`,
      );
      const d = await r.json();
      setVerify({
        status: "done",
        verified: !!d.verified,
        checksumValid: !!d.checksumValid,
        legalName: d.legalName ?? null,
        message: d.message ?? "",
      });
      // Pré-remplit l'adresse depuis la source officielle si elle est vide.
      if (d.verified) {
        setForm((f) => ({
          ...f,
          name: f.name || d.legalName || "",
          street: f.street || d.street || "",
          postalCode: f.postalCode || d.postalCode || "",
          city: f.city || d.city || "",
        }));
      }
    } catch {
      setVerify({ ...EMPTY_VERIFY, status: "done", message: "" });
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    try {
      const res = await fetch("/api/formations/organismes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          website: form.website || undefined,
          enterpriseNumber: form.enterpriseNumber || undefined,
          contactRole: form.contactRole || undefined,
          contactPhone: form.contactPhone || undefined,
          street: form.street || undefined,
          postalCode: form.postalCode || undefined,
          city: form.city || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.issues?.fieldErrors) setErrors(data.issues.fieldErrors);
        toast.error(data.error ?? "Envoi impossible.");
        return;
      }
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <section className="glass-surface mx-auto flex w-full max-w-xl flex-col items-center gap-4 px-6 py-16 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-[color:var(--glass-success-surface)] text-[color:var(--glass-success-ink)]">
          <CheckCircle2Icon className="size-8" />
        </span>
        <h1 className="glass-display text-[24px] font-semibold">Demande envoyée</h1>
        <p className="max-w-md text-[14px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
          Merci ! Votre demande est en cours de vérification par l&apos;équipe Docbel.
          Vous recevrez un email dès qu&apos;elle sera validée — vous pourrez alors vous
          connecter et publier vos formations.
        </p>
        <Link
          href="/formations"
          className="glass-cta mt-2 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold"
        >
          Découvrir le catalogue
        </Link>
      </section>
    );
  }

  const err = (k: string) => errors[k]?.[0];

  return (
    <div className="flex flex-col gap-7">
      <section className="glass-surface flex flex-col gap-3 p-7">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[color:var(--glass-surface-strong)] px-3 py-1 text-[11.5px] font-bold uppercase tracking-wide text-[color:var(--glass-accent-deep)]">
          <BuildingIcon className="size-3.5" />
          Organismes de formation
        </span>
        <h1 className="glass-display text-[30px] font-semibold">
          Proposez vos formations sur Docbel
        </h1>
        <p className="max-w-2xl text-[14.5px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
          Écoles, ASBL, sociétés, administrations, formateurs indépendants : publiez
          votre catalogue, gérez vos sessions et vos inscriptions. Docbel vérifie
          chaque organisation avant publication, pour garantir la qualité des
          informations affichées.
        </p>
        <div className="mt-1 flex flex-wrap gap-4 text-[12.5px] text-[color:var(--glass-ink-soft)]">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheckIcon className="size-4 text-[color:var(--glass-accent-deep)]" />
            Gratuit et sans engagement
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BadgeCheckIcon className="size-4 text-[color:var(--glass-accent-deep)]" />
            Vérification officielle du n° d&apos;entreprise
          </span>
          <span className="inline-flex items-center gap-1.5">
            <UsersIcon className="size-4 text-[color:var(--glass-accent-deep)]" />
            Invitez votre équipe
          </span>
        </div>
      </section>

      <form onSubmit={submit} className="flex flex-col gap-5">
        <fieldset className="glass-surface flex flex-col gap-4 p-6">
          <legend className="px-1 text-[15px] font-bold">Votre organisation</legend>

          <Field label="Type d'organisation" error={err("type")}>
            <select
              className={inputCls}
              value={form.type}
              onChange={(e) => set("type", e.target.value as FormationOrgType)}
            >
              {PUBLIC_ORG_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ORG_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Numéro d'entreprise (BCE)"
            hint="Facultatif pour un formateur indépendant sans BCE."
            error={err("enterpriseNumber")}
          >
            <div className="flex gap-2">
              <input
                className={inputCls}
                placeholder="0123.456.789"
                value={form.enterpriseNumber}
                onChange={(e) => set("enterpriseNumber", e.target.value)}
                onBlur={checkBce}
              />
              <button
                type="button"
                onClick={checkBce}
                disabled={verify.status === "checking"}
                className="shrink-0 rounded-xl border border-[color:var(--glass-border)] px-4 text-[13px] font-semibold"
              >
                {verify.status === "checking" ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  "Vérifier"
                )}
              </button>
            </div>
            {verify.status === "done" && verify.message && (
              <p
                className={`mt-1.5 text-[12.5px] ${
                  verify.verified
                    ? "text-[color:var(--glass-success-ink)]"
                    : "text-[color:var(--glass-ink-faint)]"
                }`}
              >
                {verify.verified && <BadgeCheckIcon className="mr-1 inline size-3.5" />}
                {verify.message}
              </p>
            )}
          </Field>

          <Field label="Nom de l'organisation" error={err("name")}>
            <input
              className={inputCls}
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex : Institut Saint-Joseph"
            />
          </Field>

          <Field
            label="Description"
            hint="Qui êtes-vous, quel type de formations proposez-vous ?"
            error={err("description")}
          >
            <textarea
              className={`${inputCls} min-h-24 resize-y`}
              required
              minLength={20}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Site web" error={err("website")}>
              <input
                className={inputCls}
                type="url"
                placeholder="https://…"
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
              />
            </Field>
            <Field label="Rue et numéro" error={err("street")}>
              <input
                className={inputCls}
                value={form.street}
                onChange={(e) => set("street", e.target.value)}
              />
            </Field>
            <Field label="Code postal" error={err("postalCode")}>
              <input
                className={inputCls}
                value={form.postalCode}
                onChange={(e) => set("postalCode", e.target.value)}
              />
            </Field>
            <Field label="Commune" error={err("city")}>
              <input
                className={inputCls}
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="glass-surface flex flex-col gap-4 p-6">
          <legend className="px-1 text-[15px] font-bold">Votre compte</legend>
          <p className="text-[12.5px] text-[color:var(--glass-ink-faint)]">
            Ce compte deviendra le propriétaire de l&apos;organisation. Vous pourrez
            inviter vos collègues ensuite.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Votre nom" error={err("contactName")}>
              <input
                className={inputCls}
                required
                value={form.contactName}
                onChange={(e) => set("contactName", e.target.value)}
              />
            </Field>
            <Field label="Votre fonction" error={err("contactRole")}>
              <input
                className={inputCls}
                placeholder="Ex : Responsable formation"
                value={form.contactRole}
                onChange={(e) => set("contactRole", e.target.value)}
              />
            </Field>
            <Field label="Email professionnel" error={err("contactEmail")}>
              <input
                className={inputCls}
                type="email"
                required
                value={form.contactEmail}
                onChange={(e) => set("contactEmail", e.target.value)}
              />
            </Field>
            <Field label="Téléphone" error={err("contactPhone")}>
              <input
                className={inputCls}
                value={form.contactPhone}
                onChange={(e) => set("contactPhone", e.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Mot de passe"
            hint="10 caractères minimum."
            error={err("password")}
          >
            <input
              className={inputCls}
              type="password"
              required
              minLength={10}
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
            />
          </Field>

          <label className="flex items-start gap-2.5 text-[13px] text-[color:var(--glass-ink-soft)]">
            <input
              type="checkbox"
              required
              checked={form.acceptTerms}
              onChange={(e) => set("acceptTerms", e.target.checked)}
              className="mt-0.5 size-4"
            />
            <span>
              Je confirme être habilité(e) à représenter cette organisation et
              j&apos;accepte les{" "}
              <Link href="/conditions" className="font-semibold underline">
                conditions d&apos;utilisation
              </Link>
              .
            </span>
          </label>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="glass-cta inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-bold disabled:opacity-60"
          >
            {submitting ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <SendIcon className="size-4" />
            )}
            Envoyer ma demande
          </button>
          <p className="text-[12.5px] text-[color:var(--glass-ink-faint)]">
            Votre demande est vérifiée manuellement — généralement sous 48 h.
          </p>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-[color:var(--glass-ink)]">
        {label}
      </span>
      {children}
      {hint && !error && (
        <span className="text-[12px] text-[color:var(--glass-ink-faint)]">{hint}</span>
      )}
      {error && <span className="text-[12px] text-[color:var(--destructive)]">{error}</span>}
    </label>
  );
}
