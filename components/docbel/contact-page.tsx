"use client";

import { useState } from "react";
import {
  CheckCircle2Icon,
  ClockIcon,
  MailIcon,
  MessageCircleIcon,
  ShieldCheckIcon,
} from "lucide-react";

interface ContactPageProps {
  accent?: string;
}

const CONTACT_EMAIL_PARTS = ["contact", "docbel", "be"];
const getContactEmail = () =>
  CONTACT_EMAIL_PARTS.join("@").replace("@be", ".be");

const SUBJECTS = [
  "Question générale",
  "Aide sur un formulaire",
  "Suggestion d'outil",
  "Signaler un bug",
  "Partenariat",
  "Presse",
  "Autre",
];

export function ContactPage(_: ContactPageProps) {
  void _;
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [acceptData, setAcceptData] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [contactEmail] = useState(() => getContactEmail());

  const handleInputChange = (name: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/contact-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to submit message");

      setSubmitted(true);
      setFormData({ name: "", email: "", subject: "", message: "" });
      setAcceptData(false);
      window.setTimeout(() => setSubmitted(false), 4000);
    } catch (err) {
      console.error("Error submitting form:", err);
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid =
    formData.name &&
    formData.email &&
    formData.subject &&
    formData.message &&
    acceptData;

  const fieldClass =
    "w-full rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-4 py-3 text-[14px] text-[color:var(--glass-ink)] placeholder:text-[color:var(--glass-ink-faint)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]";

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 px-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
          Nous contacter
        </p>
        <h1 className="glass-display text-[40px] font-semibold leading-[1.05] sm:text-[48px]">
          Une question ? <em>Écrivez-nous.</em>
        </h1>
        <p className="max-w-2xl text-[14px] text-[color:var(--glass-ink-soft)]">
          On vous répond généralement sous 48h ouvrées. Pour les demandes
          urgentes liées à un dossier ONEM, contactez directement votre bureau
          local.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <form onSubmit={handleSubmit} className="glass-surface flex flex-col gap-5 p-7">
          {submitted ? (
            <div
              className="flex items-start gap-3 rounded-2xl p-4 text-[13.5px]"
              style={{
                background: "rgba(80, 200, 140, 0.12)",
                color: "#1d6b3e",
              }}
            >
              <CheckCircle2Icon className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="font-bold">Message envoyé.</p>
                <p className="opacity-80">
                  Merci pour votre prise de contact. Notre équipe vous répond
                  sous 48h ouvrées.
                </p>
              </div>
            </div>
          ) : null}

          {error ? (
            <div
              className="rounded-2xl p-4 text-[13.5px] font-semibold"
              style={{
                background: "rgba(220, 80, 100, 0.12)",
                color: "#b8324a",
              }}
            >
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-soft)]">
                Nom complet
              </span>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Marie Dupont"
                className={fieldClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-soft)]">
                E-mail
              </span>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                placeholder="vous@exemple.be"
                className={fieldClass}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-soft)]">
              Sujet
            </span>
            <select
              required
              value={formData.subject}
              onChange={(e) => handleInputChange("subject", e.target.value)}
              className={fieldClass}
            >
              <option value="">Sélectionnez un sujet…</option>
              {SUBJECTS.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-[color:var(--glass-ink-soft)]">
              Message
            </span>
            <textarea
              required
              rows={6}
              value={formData.message}
              onChange={(e) => handleInputChange("message", e.target.value)}
              placeholder="Décrivez votre demande en quelques lignes…"
              className={`${fieldClass} resize-y`}
            />
          </label>

          <label className="flex items-start gap-3 text-[12.5px] text-[color:var(--glass-ink-soft)]">
            <input
              type="checkbox"
              checked={acceptData}
              onChange={(e) => setAcceptData(e.target.checked)}
              className="mt-0.5 size-4 accent-[color:var(--glass-accent-deep)]"
            />
            <span>
              J&apos;accepte que mes données soient utilisées pour répondre à
              cette demande. Aucune information n&apos;est partagée avec un
              tiers.
            </span>
          </label>

          <button
            type="submit"
            disabled={!isFormValid || isLoading}
            className="inline-flex items-center justify-center gap-2 self-start rounded-full px-6 py-3 text-[13.5px] font-bold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: "var(--glass-ink)",
              color: "var(--glass-bg-a)",
            }}
          >
            {isLoading ? "Envoi…" : "Envoyer le message"}
          </button>
        </form>

        <aside className="flex flex-col gap-4">
          <div className="glass-surface flex gap-3 p-5">
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-deep))",
              }}
            >
              <MailIcon className="size-5" />
            </span>
            <div>
              <p className="text-[13.5px] font-bold">E-mail direct</p>
              <a
                href={`mailto:${contactEmail}`}
                className="mt-1 inline-block text-[12.5px] font-semibold text-[color:var(--glass-accent-deep)] hover:underline"
              >
                {contactEmail}
              </a>
            </div>
          </div>

          <div className="glass-surface flex gap-3 p-5">
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, var(--glass-accent-c), var(--glass-accent-d))",
              }}
            >
              <ClockIcon className="size-5" />
            </span>
            <div>
              <p className="text-[13.5px] font-bold">Temps de réponse</p>
              <p className="mt-1 text-[12.5px] text-[color:var(--glass-ink-soft)]">
                Sous 48h ouvrées pour les questions générales.
              </p>
            </div>
          </div>

          <div className="glass-surface flex gap-3 p-5">
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, var(--glass-accent-deep), var(--glass-accent-a))",
              }}
            >
              <ShieldCheckIcon className="size-5" />
            </span>
            <div>
              <p className="text-[13.5px] font-bold">Confidentialité</p>
              <p className="mt-1 text-[12.5px] text-[color:var(--glass-ink-soft)]">
                Vos données ne sont utilisées que pour répondre à votre
                message.
              </p>
            </div>
          </div>

          <div className="glass-surface flex gap-3 p-5">
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #80B0FF, #5060FF)",
              }}
            >
              <MessageCircleIcon className="size-5" />
            </span>
            <div>
              <p className="text-[13.5px] font-bold">Vous avez un dossier urgent ?</p>
              <p className="mt-1 text-[12.5px] text-[color:var(--glass-ink-soft)]">
                Contactez directement votre bureau ONEM ou votre organisme de
                paiement.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
