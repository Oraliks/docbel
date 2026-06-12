"use client";

// Section « La prise de rendez-vous, simplifiée pour vos affiliés » —
// landing publique /p/partenaire. Vitrine du parcours public /rendez-vous
// (stepper réel : démarche → organisme → code postal, puis créneau et
// confirmation). Les 3 cartes apparaissent en séquence (fadeInUp décalé) à
// l'entrée dans le viewport : l'IntersectionObserver met l'état de façon
// asynchrone (conforme à react-hooks/set-state-in-effect) et tout est
// neutralisé par prefers-reduced-motion.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  BellRingIcon,
  Building2Icon,
  CalendarDaysIcon,
  CalendarPlusIcon,
  type LucideIcon,
  MapPinIcon,
  ShieldCheckIcon,
  ZapIcon,
} from "lucide-react";

// Glow violet doux des illustrations 3D (même recette que le hero de la home).
const ASSET_GLOW =
  "drop-shadow(0 10px 18px rgba(20,10,45,0.4)) drop-shadow(0 0 14px color-mix(in oklab, var(--glass-accent-deep) 50%, transparent))";

// Tuiles dégradées — mêmes valeurs que ICON_BG/ICON_SHADOW de la landing
// /p/partenaire pour garder le rythme visuel violet → orange → rose.
const TILES: { bg: string; shadow: string }[] = [
  {
    bg: "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-deep))",
    shadow: "0 6px 20px rgba(159,124,255,0.35)",
  },
  {
    bg: "linear-gradient(135deg, var(--glass-accent-d), #FF8050)",
    shadow: "0 6px 20px rgba(255,176,112,0.35)",
  },
  {
    bg: "linear-gradient(135deg, var(--glass-accent-c), #E060A0)",
    shadow: "0 6px 20px rgba(255,140,192,0.35)",
  },
];

interface StepItem {
  Icon: LucideIcon;
  title: string;
  desc: string;
}

// Étapes fidèles au parcours public réel (/rendez-vous puis /{slug}/rendez-vous).
// La formulation NRN est factuelle : haché (HMAC) pour l'anti-doublon
// (lib/booking/dedupe.ts) et chiffré au repos (lib/booking/crypto-nrn.ts) —
// jamais conservé en clair.
const STEPS: StepItem[] = [
  {
    Icon: MapPinIcon,
    title: "Choix du guichet et du motif",
    desc: "Votre affilié sélectionne sa démarche, son organisme et son code postal : il est orienté directement vers le guichet compétent, près de chez lui.",
  },
  {
    Icon: CalendarDaysIcon,
    title: "Créneau en ligne",
    desc: "Les disponibilités s'affichent semaine par semaine et la réservation se fait en quelques clics — plus d'attente téléphonique.",
  },
  {
    Icon: ShieldCheckIcon,
    title: "Confirmation sécurisée",
    desc: "Confirmation immédiate par e-mail, avec un lien pour gérer ou annuler le rendez-vous. Le numéro de registre national n'est jamais conservé en clair : il est haché (HMAC) pour le contrôle anti-doublon et chiffré au repos.",
  },
];

// Atouts factuels de la plateforme (auto-approbation, rappel la veille,
// export .ics, multi-guichets — cf. lib/booking/* et lib/rendez-vous/ics.ts).
const FEATURE_CHIPS: { Icon: LucideIcon; label: string }[] = [
  { Icon: ZapIcon, label: "Approbation automatique" },
  { Icon: BellRingIcon, label: "Rappel la veille" },
  { Icon: CalendarPlusIcon, label: "Export .ics" },
  { Icon: Building2Icon, label: "Multi-guichets" },
];

export function BookingShowcase() {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = gridRef.current;
    if (!node) return;
    // Environnement sans IntersectionObserver : affichage différé sans séquence
    // (setTimeout → setState asynchrone, jamais synchrone dans l'effet).
    if (typeof IntersectionObserver === "undefined") {
      const timer = window.setTimeout(() => setVisible(true), 0);
      return () => window.clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="relative flex w-full flex-col gap-7">
      {/* Vignette 3D flottante — pur décor */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/3d/compass.png"
        alt=""
        aria-hidden
        className="hero-float pointer-events-none absolute -top-4 right-2 hidden h-16 w-16 object-contain sm:block lg:right-10"
        style={{ filter: ASSET_GLOW }}
      />

      {/* En-tête de section */}
      <div className="flex flex-col gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
          Rendez-vous en ligne
        </p>
        <h2 className="glass-display max-w-3xl text-[30px] leading-[1.1] font-semibold tracking-tight sm:text-[38px]">
          La prise de rendez-vous, <em>simplifiée</em> pour vos affiliés
        </h2>
        <p className="max-w-[640px] text-[14.5px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
          Ouvrez des guichets en ligne pour votre organisation&nbsp;: vos
          affiliés réservent un créneau en quelques minutes et votre équipe
          garde la main sur l&apos;agenda.
        </p>
      </div>

      {/* 3 étapes — apparition en séquence (fadeInUp décalé via .outils-rise) */}
      <div ref={gridRef} className="grid gap-4 lg:grid-cols-3">
        {STEPS.map(({ Icon, title, desc }, index) => (
          <article
            key={title}
            className={`glass-surface flex flex-col gap-3.5 p-6 ${
              visible
                ? "outils-rise motion-reduce:animate-none"
                : "opacity-0 motion-reduce:opacity-100"
            }`}
            style={visible ? { animationDelay: `${index * 140}ms` } : undefined}
          >
            <div className="flex items-center justify-between gap-3">
              <span
                className="flex size-12 items-center justify-center rounded-2xl text-white"
                style={{
                  backgroundImage: TILES[index].bg,
                  boxShadow: TILES[index].shadow,
                }}
              >
                <Icon className="size-5" strokeWidth={2.2} />
              </span>
              <span
                className="inline-flex items-center rounded-full border px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em]"
                style={{
                  borderColor:
                    "color-mix(in oklab, var(--glass-accent-deep) 30%, transparent)",
                  background:
                    "color-mix(in oklab, var(--glass-accent-a) 12%, var(--glass-surface))",
                  color: "var(--glass-accent-deep)",
                }}
              >
                Étape {index + 1}
              </span>
            </div>
            <h3 className="text-[15.5px] font-bold tracking-tight">{title}</h3>
            <p className="text-[12.5px] leading-[1.55] text-[color:var(--glass-ink-soft)]">
              {desc}
            </p>
          </article>
        ))}
      </div>

      {/* Atouts de la plateforme */}
      <ul className="flex flex-wrap gap-2">
        {FEATURE_CHIPS.map(({ Icon, label }) => (
          <li
            key={label}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-3.5 py-2 text-[12px] font-semibold text-[color:var(--glass-ink-soft)]"
          >
            <Icon
              className="size-3.5"
              style={{ color: "var(--glass-accent-deep)" }}
              strokeWidth={2.4}
            />
            {label}
          </li>
        ))}
      </ul>

      {/* CTA vers le parcours public réel */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/rendez-vous"
          className="glass-cta inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-bold"
        >
          Voir le parcours public
          <ArrowRightIcon className="size-4" strokeWidth={2.4} />
        </Link>
        <p className="text-[12.5px] text-[color:var(--glass-ink-faint)]">
          Exactement le parcours que vos affiliés utiliseront.
        </p>
      </div>
    </section>
  );
}
