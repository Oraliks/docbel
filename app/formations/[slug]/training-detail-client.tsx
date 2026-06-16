"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  AwardIcon,
  CalendarRangeIcon,
  CheckCircle2Icon,
  ClockIcon,
  FlagIcon,
  GlobeIcon,
  HeartIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react";
import { resolveIcon } from "@/components/formations/icons";
import {
  certificateLabel,
  formatLabel,
  formatPrice,
  durationText,
  formatDate,
  formatDateTime,
  levelLabel,
} from "@/components/formations/format";
import { useSavedFormations } from "@/hooks/useSavedFormations";
import { VISIBILITY_LABELS, REPORT_REASONS, REPORT_REASON_LABELS } from "@/lib/formations/constants";

export interface SessionView {
  id: string;
  title: string | null;
  status: string;
  mode: string;
  startsAt: string | null;
  endsAt: string | null;
  city: string | null;
  region: string | null;
  locationName: string | null;
  address: string | null;
  onlineUrl: string | null;
  capacity: number | null;
  seatsLeft: number | null;
  registrationDeadline: string | null;
  instructions: string | null;
  isOpen: boolean;
}

export interface TrainingDetailView {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  objectives: string[];
  targetAudience: string | null;
  prerequisites: string | null;
  level: string;
  language: string;
  format: string;
  durationHours: number | null;
  durationLabel: string | null;
  rhythm: string | null;
  priceType: string;
  priceAmount: number | null;
  currency: string;
  externalPaymentUrl: string | null;
  paymentInfo: string | null;
  cancellationPolicy: string | null;
  certificateType: string;
  certificateDescription: string | null;
  visibility: string;
  isVerifiedByDocbel: boolean;
  isDocbelRecommended: boolean;
  externalUrl: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactWebsite: string | null;
  organization: {
    name: string;
    slug: string;
    type: string;
    logoUrl: string | null;
    brandColor: string | null;
    website: string | null;
  };
  category: { slug: string; name: string; color: string; icon: string | null } | null;
  tags: { slug: string; name: string }[];
  sessions: SessionView[];
}

export function TrainingDetailClient({ training }: { training: TrainingDetailView }) {
  const { isSaved, toggle } = useSavedFormations();
  const saved = isSaved(training.slug);
  const Icon = resolveIcon(training.category?.icon);
  const accent = training.category?.color ?? "#7C3AED";
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const openSessions = training.sessions.filter((s) => s.isOpen);
  const isPrivate = training.visibility === "private" || training.visibility === "internal";

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/formations"
        className="inline-flex w-fit items-center gap-1.5 text-[12.5px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:text-[color:var(--glass-ink)]"
      >
        <ArrowLeftIcon className="size-3.5" />
        Toutes les formations
      </Link>

      {isPrivate && (
        <div className="glass-surface flex items-center gap-2 px-4 py-3 text-[12.5px] font-semibold text-[color:var(--glass-ink-soft)]">
          <ShieldCheckIcon className="size-4 text-[color:var(--glass-accent-deep)]" />
          {training.visibility === "internal"
            ? "Formation interne à une organisation — vous y avez accès."
            : "Formation privée — vous y avez accès."}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* MAIN */}
        <div className="flex flex-col gap-6">
          <section className="glass-surface flex flex-col gap-4 p-7">
            <div className="flex items-start gap-4">
              <span
                className="glass-icon-tile flex size-14 shrink-0 items-center justify-center rounded-2xl"
                style={{ background: `color-mix(in oklab, ${accent} 18%, transparent)`, color: accent }}
              >
                <Icon className="size-7" strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--glass-ink-faint)]">
                  {training.organization.name}
                </p>
                <h1 className="glass-display mt-1 text-[27px] font-semibold leading-tight">
                  {training.title}
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {training.isVerifiedByDocbel && (
                <Badge tone="violet" icon={<ShieldCheckIcon className="size-3" />}>
                  Validée Docbel
                </Badge>
              )}
              {training.isDocbelRecommended && (
                <Badge tone="violet" icon={<SparklesIcon className="size-3" />}>
                  Recommandée Docbel
                </Badge>
              )}
              {training.category && (
                <Badge tone="neutral">{training.category.name}</Badge>
              )}
              <Badge tone="neutral">{formatLabel(training.format)}</Badge>
              <Badge tone="neutral">{levelLabel(training.level)}</Badge>
            </div>

            {training.shortDescription && (
              <p className="text-[15px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
                {training.shortDescription}
              </p>
            )}
          </section>

          {training.description && (
            <Section title="Description">
              <p className="whitespace-pre-line text-[14px] leading-[1.7] text-[color:var(--glass-ink-soft)]">
                {training.description}
              </p>
            </Section>
          )}

          {training.objectives.length > 0 && (
            <Section title="Objectifs">
              <ul className="flex flex-col gap-2">
                {training.objectives.map((o, i) => (
                  <li key={i} className="flex items-start gap-2 text-[14px] text-[color:var(--glass-ink-soft)]">
                    <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-[color:var(--glass-accent-deep)]" />
                    {o}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {(training.targetAudience || training.prerequisites) && (
            <Section title="Pour qui ?">
              <div className="flex flex-col gap-3">
                {training.targetAudience && (
                  <div>
                    <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[color:var(--glass-ink-faint)]">
                      Public cible
                    </p>
                    <p className="mt-1 whitespace-pre-line text-[14px] text-[color:var(--glass-ink-soft)]">
                      {training.targetAudience}
                    </p>
                  </div>
                )}
                {training.prerequisites && (
                  <div>
                    <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[color:var(--glass-ink-faint)]">
                      Prérequis
                    </p>
                    <p className="mt-1 whitespace-pre-line text-[14px] text-[color:var(--glass-ink-soft)]">
                      {training.prerequisites}
                    </p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* SESSIONS */}
          <Section title="Sessions disponibles" id="sessions">
            {openSessions.length === 0 ? (
              <p className="text-[13.5px] text-[color:var(--glass-ink-soft)]">
                Aucune session ouverte à l&apos;inscription pour le moment.
                {training.contactEmail ? " Contactez l'organisateur pour être tenu informé." : ""}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {openSessions.map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    active={activeSession === s.id}
                    onToggle={() => setActiveSession(activeSession === s.id ? null : s.id)}
                  />
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* SIDEBAR */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <section className="glass-surface flex flex-col gap-4 p-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--glass-ink-faint)]">
                Prix
              </p>
              <p className="glass-display text-[28px] font-semibold">
                {formatPrice(training.priceType, training.priceAmount, training.currency)}
              </p>
            </div>

            <dl className="flex flex-col gap-2 border-t border-[color:var(--glass-ink-line)] pt-3 text-[13px]">
              <InfoRow icon={<GlobeIcon className="size-4" />} label="Format" value={formatLabel(training.format)} />
              {durationText(training.durationHours, training.durationLabel) && (
                <InfoRow
                  icon={<ClockIcon className="size-4" />}
                  label="Durée"
                  value={durationText(training.durationHours, training.durationLabel)!}
                />
              )}
              {training.rhythm && (
                <InfoRow icon={<CalendarRangeIcon className="size-4" />} label="Rythme" value={training.rhythm} />
              )}
              <InfoRow
                icon={<AwardIcon className="size-4" />}
                label="Attestation"
                value={certificateLabel(training.certificateType)}
              />
            </dl>

            {openSessions.length > 0 ? (
              <a
                href="#sessions"
                onClick={() => setActiveSession(openSessions[0].id)}
                className="glass-cta inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[14px] font-bold"
              >
                Demander une inscription
              </a>
            ) : training.externalUrl ? (
              <a
                href={training.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-cta inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[14px] font-bold"
              >
                Plus d&apos;informations
              </a>
            ) : null}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => toggle(training.slug)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-4 py-2.5 text-[12.5px] font-bold transition hover:bg-white/55 dark:hover:bg-white/10"
                style={{ color: saved ? "var(--glass-accent-c)" : "var(--glass-ink)" }}
              >
                <HeartIcon className={`size-4 ${saved ? "fill-current" : ""}`} />
                {saved ? "Sauvegardée" : "Sauvegarder"}
              </button>
              <button
                type="button"
                onClick={() => setReportOpen((v) => !v)}
                aria-label="Signaler la formation"
                className="inline-flex items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-4 py-2.5 text-[12.5px] font-bold text-[color:var(--glass-ink-soft)] transition hover:bg-white/55 dark:hover:bg-white/10"
              >
                <FlagIcon className="size-4" />
              </button>
            </div>

            {training.priceType === "paid" && training.externalPaymentUrl && (
              <p className="text-[11.5px] leading-[1.4] text-[color:var(--glass-ink-faint)]">
                Le paiement s&apos;effectue auprès de l&apos;organisateur, pas via Docbel.
              </p>
            )}
          </section>

          {/* Organisme */}
          <section className="glass-surface flex flex-col gap-2 p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--glass-ink-faint)]">
              Organisme
            </p>
            <p className="text-[14px] font-bold">{training.organization.name}</p>
            {(training.contactEmail || training.contactPhone || training.contactWebsite) && (
              <div className="mt-1 flex flex-col gap-1.5 text-[12.5px] text-[color:var(--glass-ink-soft)]">
                {training.contactEmail && (
                  <a href={`mailto:${training.contactEmail}`} className="inline-flex items-center gap-2 hover:text-[color:var(--glass-ink)]">
                    <MailIcon className="size-3.5" />
                    {training.contactEmail}
                  </a>
                )}
                {training.contactPhone && (
                  <span className="inline-flex items-center gap-2">
                    <PhoneIcon className="size-3.5" />
                    {training.contactPhone}
                  </span>
                )}
                {training.contactWebsite && (
                  <a href={training.contactWebsite} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-[color:var(--glass-ink)]">
                    <GlobeIcon className="size-3.5" />
                    Site web
                  </a>
                )}
              </div>
            )}
          </section>

          {reportOpen && (
            <ReportForm trainingId={training.id} onDone={() => setReportOpen(false)} />
          )}
        </aside>
      </div>
    </div>
  );
}

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="glass-surface flex flex-col gap-3 p-6 lg:p-7">
      <h2 className="text-[16px] font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="inline-flex items-center gap-2 text-[color:var(--glass-ink-faint)]">
        {icon}
        {label}
      </span>
      <span className="font-semibold text-[color:var(--glass-ink)]">{value}</span>
    </div>
  );
}

const TONE: Record<string, React.CSSProperties> = {
  violet: { background: "var(--glass-pop-bg)", color: "var(--glass-pop-fg)" },
  neutral: { background: "var(--glass-surface-strong)", color: "var(--glass-ink-soft)" },
};
function Badge({ tone, icon, children }: { tone: "violet" | "neutral"; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={TONE[tone]}
    >
      {icon}
      {children}
    </span>
  );
}

function SessionRow({
  session,
  active,
  onToggle,
}: {
  session: SessionView;
  active: boolean;
  onToggle: () => void;
}) {
  const full = session.seatsLeft != null && session.seatsLeft <= 0;
  return (
    <div className="rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="inline-flex items-center gap-2 text-[14px] font-bold">
            <CalendarRangeIcon className="size-4 text-[color:var(--glass-accent-deep)]" />
            {session.startsAt ? formatDateTime(session.startsAt) : "Dates à confirmer"}
          </p>
          <p className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[color:var(--glass-ink-soft)]">
            <span className="inline-flex items-center gap-1">
              <GlobeIcon className="size-3.5" />
              {formatLabel(session.mode)}
            </span>
            {session.city && (
              <span className="inline-flex items-center gap-1">
                <MapPinIcon className="size-3.5" />
                {session.city}
              </span>
            )}
            {session.seatsLeft != null && (
              <span className="inline-flex items-center gap-1">
                <UsersIcon className="size-3.5" />
                {session.seatsLeft > 0 ? `${session.seatsLeft} place${session.seatsLeft > 1 ? "s" : ""}` : "Complet"}
              </span>
            )}
            {session.registrationDeadline && (
              <span>Clôture le {formatDate(session.registrationDeadline)}</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="glass-cta inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-bold"
        >
          {active ? "Fermer" : full ? "Liste d'attente" : "S'inscrire"}
        </button>
      </div>
      {active && <EnrollForm sessionId={session.id} full={full} onDone={onToggle} />}
    </div>
  );
}

function EnrollForm({ sessionId, full, onDone }: { sessionId: string; full: boolean; onDone: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [accept, setAccept] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!accept) {
      toast.error("Veuillez accepter les conditions.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/formations/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          citizenName: name,
          citizenEmail: email,
          citizenPhone: phone || undefined,
          message: message || undefined,
          acceptTerms: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Inscription impossible.");
        return;
      }
      if (data.status === "waitlisted") {
        toast.success("Vous êtes sur la liste d'attente. Nous vous préviendrons si une place se libère.");
      } else if (data.status === "accepted") {
        toast.success("Inscription confirmée ! Vous recevrez les détails par email.");
      } else {
        toast.success("Demande envoyée ! L'organisateur va l'examiner.");
      }
      onDone();
    } catch {
      toast.error("Une erreur est survenue. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    "glass-surface-strong h-11 w-full rounded-xl border-0 px-3.5 text-[13.5px] text-[color:var(--glass-ink)] placeholder:text-[color:var(--glass-ink-faint)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]";

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-2.5 border-t border-[color:var(--glass-ink-line)] pt-4">
      {full && (
        <p className="text-[12px] font-semibold text-[color:var(--glass-ink-soft)]">
          Cette session est complète — votre demande rejoindra la liste d&apos;attente.
        </p>
      )}
      <div className="grid gap-2.5 sm:grid-cols-2">
        <input className={inputCls} placeholder="Nom complet" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className={inputCls} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <input className={inputCls} placeholder="Téléphone (optionnel)" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <textarea
        className="glass-surface-strong min-h-[72px] w-full rounded-xl border-0 px-3.5 py-2.5 text-[13.5px] text-[color:var(--glass-ink)] placeholder:text-[color:var(--glass-ink-faint)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
        placeholder="Message (optionnel)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <label className="flex items-start gap-2 text-[12px] text-[color:var(--glass-ink-soft)]">
        <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-0.5" />
        J&apos;accepte que mes coordonnées soient transmises à l&apos;organisateur pour traiter ma demande.
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="glass-cta inline-flex items-center justify-center rounded-full px-5 py-2.5 text-[13px] font-bold disabled:opacity-60"
      >
        {submitting ? "Envoi…" : "Envoyer ma demande"}
      </button>
    </form>
  );
}

function ReportForm({ trainingId, onDone }: { trainingId: string; onDone: () => void }) {
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/formations/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainingId, reason, message: message || undefined }),
      });
      if (!res.ok) {
        toast.error("Signalement impossible.");
        return;
      }
      toast.success("Merci, votre signalement a été transmis à Docbel.");
      onDone();
    } catch {
      toast.error("Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="glass-surface flex flex-col gap-2.5 p-5">
      <p className="text-[13px] font-bold">Signaler cette formation</p>
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="glass-surface-strong h-11 w-full rounded-xl border-0 px-3 text-[13px] text-[color:var(--glass-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
      >
        {REPORT_REASONS.map((r) => (
          <option key={r} value={r}>
            {REPORT_REASON_LABELS[r]}
          </option>
        ))}
      </select>
      <textarea
        className="glass-surface-strong min-h-[64px] w-full rounded-xl border-0 px-3.5 py-2.5 text-[13px] text-[color:var(--glass-ink)] placeholder:text-[color:var(--glass-ink-faint)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)]"
        placeholder="Précisez (optionnel)"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="glass-cta rounded-full px-4 py-2 text-[12.5px] font-bold disabled:opacity-60">
          {submitting ? "Envoi…" : "Envoyer"}
        </button>
        <button type="button" onClick={onDone} className="rounded-full px-4 py-2 text-[12.5px] font-semibold text-[color:var(--glass-ink-soft)]">
          Annuler
        </button>
      </div>
    </form>
  );
}

export { VISIBILITY_LABELS };
