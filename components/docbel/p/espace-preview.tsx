"use client";

// Section « Visitez l'espace partenaire » — landing publique /p/partenaire.
//
// Aperçu à onglets 100 % STATIQUE : trois maquettes en verre (agenda d'équipe,
// calcul AGR, lookup ONEM) avec des données FICTIVES clairement étiquetées
// « Aperçu ». Aucune donnée réelle, aucun appel API : l'objectif est seulement
// de donner un avant-goût crédible des outils réels de l'espace partenaire
// (entrées de navigation réelles : cf. lib/pro-nav.ts).

import { useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CalculatorIcon,
  CalendarDaysIcon,
  FileCheck2Icon,
  LayoutDashboardIcon,
  type LucideIcon,
  SearchIcon,
  UsersIcon,
} from "lucide-react";
import { GLASS_POP_STYLE, GLASS_PRIMARY_STYLE } from "@/lib/glass-classes";

// ─── Onglets ─────────────────────────────────────────────────────────────────

type TabKey = "agenda" | "agr" | "lookup";

const TABS: {
  key: TabKey;
  label: string;
  Icon: LucideIcon;
  panelTitle: string;
}[] = [
  {
    key: "agenda",
    label: "Agenda rendez-vous",
    Icon: CalendarDaysIcon,
    panelTitle: "Agenda d'équipe — semaine type",
  },
  {
    key: "agr",
    label: "Calcul AGR",
    Icon: CalculatorIcon,
    panelTitle: "Calcul AGR — résultat",
  },
  {
    key: "lookup",
    label: "Lookup ONEM",
    Icon: SearchIcon,
    panelTitle: "Lookup ONEM — fiche code",
  },
];

// ─── Données fictives des maquettes ──────────────────────────────────────────
// Statuts et libellés alignés sur le vrai agenda (cf. lib/booking/status.ts :
// « Confirmé », « En attente de validation », « Honoré ») mais codés en dur
// ici : la maquette ne doit rien importer du domaine réel.

type DemoStatus = "honore" | "confirme" | "attente";

const STATUS_STYLE: Record<
  DemoStatus,
  { label: string; chip: string; dot: string }
> = {
  honore: {
    label: "Honoré",
    chip: "bg-violet-100 text-violet-800 dark:bg-violet-400/15 dark:text-violet-200",
    dot: "bg-violet-500 dark:bg-violet-300",
  },
  confirme: {
    label: "Confirmé",
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200",
    dot: "bg-emerald-500 dark:bg-emerald-300",
  },
  attente: {
    label: "En attente de validation",
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200",
    dot: "bg-amber-500 dark:bg-amber-300",
  },
};

// Semaine type : motifs réalistes côté guichet (inscription, contrôle de
// dossier, AGR, chômage temporaire, dispense), purement fictifs.
const DEMO_WEEK: {
  day: string;
  slots: { time: string; motif: string; status: DemoStatus }[];
}[] = [
  { day: "Lun", slots: [{ time: "09:00", motif: "Inscription", status: "honore" }] },
  { day: "Mar", slots: [{ time: "11:30", motif: "Contrôle dossier", status: "confirme" }] },
  {
    day: "Mer",
    slots: [
      { time: "09:00", motif: "Calcul AGR", status: "confirme" },
      { time: "14:00", motif: "Chômage temporaire", status: "attente" },
    ],
  },
  { day: "Jeu", slots: [{ time: "10:30", motif: "Dispense formation", status: "confirme" }] },
  { day: "Ven", slots: [] },
];

// Montants purement illustratifs (étiquetés « Aperçu — données fictives ») :
// le résultat réel dépend du WECH 506 importé et du barème de la période.
// Libellés alignés sur la vraie carte résultat de /partenaire/outils/calcul-agr.
const AGR_DEMO_ROWS: { label: string; value: string; strong?: boolean }[] = [
  { label: "AGR brut — Barème 57/-", value: "412,38 €" },
  { label: "Chômage temporaire", value: "64,12 €" },
  { label: "Total 57 (AGR + CT + CC)", value: "476,50 €", strong: true },
];

// ─── Contenu réel de l'espace (cf. lib/pro-nav.ts) ──────────────────────────

const SPACE_FEATURES: { Icon: LucideIcon; title: string; desc: string }[] = [
  {
    Icon: LayoutDashboardIcon,
    title: "Vue d'ensemble",
    desc: "Le tableau de bord de votre organisation, en un coup d'œil.",
  },
  {
    Icon: CalendarDaysIcon,
    title: "Agenda & demandes",
    desc: "Les rendez-vous de vos guichets, semaine par semaine.",
  },
  {
    Icon: SearchIcon,
    title: "Lookup ONEM",
    desc: "Référentiels et signalétiques officiels, consultables en quelques secondes.",
  },
  {
    Icon: CalculatorIcon,
    title: "Calcul AGR",
    desc: "L'allocation de garantie de revenus calculée à partir du WECH 506.",
  },
  {
    Icon: UsersIcon,
    title: "Membres & domaines autorisés",
    desc: "Invitez vos collègues et gérez les accès de votre organisation.",
  },
];

// ─── Maquettes ───────────────────────────────────────────────────────────────

function AgendaMock() {
  return (
    <div className="flex flex-col gap-3.5">
      {/* Barre d'outils factice (décor non interactif) */}
      <div aria-hidden className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px] font-bold text-[color:var(--glass-ink-soft)]">
          Semaine en cours
        </span>
        <div className="flex flex-wrap gap-1.5">
          {["Tous les guichets", "Tous les statuts"].map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-[color:var(--glass-ink-line)] px-2.5 py-1 text-[10.5px] font-semibold text-[color:var(--glass-ink-faint)]"
            >
              {chip}
            </span>
          ))}
        </div>
      </div>

      {/* Mini semaine Lun → Ven */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5">
        {DEMO_WEEK.map(({ day, slots }) => (
          <div
            key={day}
            className="flex min-h-[148px] flex-col gap-1.5 rounded-xl border border-[color:var(--glass-ink-line)] bg-[color:var(--glass-surface)] p-1.5 sm:p-2"
          >
            <span className="text-center text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--glass-ink-faint)]">
              {day}
            </span>
            {slots.map(({ time, motif, status }) => (
              <div
                key={`${day}-${time}`}
                className={`flex flex-col gap-0.5 rounded-lg px-1.5 py-1.5 ${STATUS_STYLE[status].chip}`}
              >
                <span className="text-[10px] font-bold tabular-nums">{time}</span>
                <span className="truncate text-[10px] font-semibold leading-tight">
                  {motif}
                </span>
              </div>
            ))}
            {slots.length === 0 && (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[color:var(--glass-ink-line)] text-[9.5px] font-semibold text-[color:var(--glass-ink-faint)]">
                Libre
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Légende des statuts */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {(Object.keys(STATUS_STYLE) as DemoStatus[]).map((status) => (
          <li
            key={status}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--glass-ink-soft)]"
          >
            <span
              className={`size-2 rounded-full ${STATUS_STYLE[status].dot}`}
              aria-hidden
            />
            {STATUS_STYLE[status].label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AgrMock() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200">
          <FileCheck2Icon className="size-3.5" strokeWidth={2.4} />
          WECH 506 importé
        </span>
        <span className="text-[12px] text-[color:var(--glass-ink-soft)]">
          Salaire de référence&nbsp;: {"2 150,00 €"}
        </span>
      </div>

      <dl className="overflow-hidden rounded-2xl border border-[color:var(--glass-ink-line)] bg-[color:var(--glass-surface)]">
        {AGR_DEMO_ROWS.map(({ label, value, strong }, index) => (
          <div
            key={label}
            className={`grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 ${
              index > 0 ? "border-t border-[color:var(--glass-ink-line)]" : ""
            }`}
          >
            <dt
              className={
                strong
                  ? "text-[13.5px] font-bold tracking-tight"
                  : "text-[13px] font-semibold text-[color:var(--glass-ink-soft)]"
              }
            >
              {label}
            </dt>
            <dd
              className={`tabular-nums ${
                strong
                  ? "text-[16px] font-bold text-[color:var(--glass-accent-deep)]"
                  : "text-[13.5px] font-semibold"
              }`}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="text-[11.5px] leading-[1.5] text-[color:var(--glass-ink-faint)]">
        Importez le WECH 506 de votre affilié&nbsp;: le calcul se fait
        automatiquement, jusqu&apos;à 4 occupations simultanées.
      </p>
    </div>
  );
}

function LookupMock() {
  return (
    <div className="flex flex-col gap-4">
      {/* Champ de recherche factice (décor non interactif) */}
      <div
        aria-hidden
        className="flex items-center gap-2.5 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-4 py-2.5"
      >
        <SearchIcon
          className="size-4 text-[color:var(--glass-ink-faint)]"
          strokeWidth={2.2}
        />
        <span className="text-[13px] text-[color:var(--glass-ink-soft)]">
          mode de paiement
        </span>
      </div>

      {/* Fiche code (structure réelle du lookup : code, description, validité,
          traduction, table source — contenu fictif) */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[color:var(--glass-ink-line)] bg-[color:var(--glass-surface)] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-xl font-mono text-[15px] font-bold"
            style={{
              background:
                "color-mix(in oklab, var(--glass-accent-a) 18%, var(--glass-surface))",
              color: "var(--glass-accent-deep)",
            }}
          >
            01
          </span>
          <div className="flex flex-col gap-0.5">
            <p className="text-[14.5px] font-bold tracking-tight">
              Virement sur compte bancaire
            </p>
            <p className="text-[11.5px] text-[color:var(--glass-ink-faint)]">
              S01 — Mode de paiement · Signalétique
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-1.5 text-[12px]">
          <dt className="text-[color:var(--glass-ink-faint)]">Néerlandais</dt>
          <dd>Overschrijving op bankrekening</dd>
          <dt className="text-[color:var(--glass-ink-faint)]">Validité</dt>
          <dd>depuis le 01.01.2020 · en cours</dd>
          <dt className="text-[color:var(--glass-ink-faint)]">Source</dt>
          <dd>Table S01 (signalétique ONEM)</dd>
        </dl>
      </div>

      <p className="text-[11.5px] leading-[1.5] text-[color:var(--glass-ink-faint)]">
        Recherche transverse dans les référentiels officiels de
        l&apos;ONEM&nbsp;: signalétique, admissibilité, dispenses, bureaux…
      </p>
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

export function EspacePreview() {
  const baseId = useId();
  const [active, setActive] = useState<TabKey>("agenda");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Navigation clavier du tablist (flèches + Home/End), pattern ARIA standard.
  function handleTablistKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = TABS.findIndex((tab) => tab.key === active);
    let next = -1;
    if (event.key === "ArrowRight") next = (current + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    if (next === -1) return;
    event.preventDefault();
    setActive(TABS[next].key);
    tabRefs.current[next]?.focus();
  }

  const activeTab = TABS.find((tab) => tab.key === active) ?? TABS[0];

  return (
    <section className="flex w-full flex-col gap-7">
      {/* En-tête de section */}
      <div className="flex flex-col gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--glass-ink-faint)]">
          Visite guidée
        </p>
        <h2 className="glass-display max-w-3xl text-[30px] leading-[1.1] font-semibold tracking-tight sm:text-[38px]">
          Visitez l&apos;<em>espace partenaire</em>
        </h2>
        <p className="max-w-[640px] text-[14.5px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
          Un aperçu sans créer de compte&nbsp;: voici à quoi ressemblent les
          outils que votre équipe utilisera au quotidien.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)] lg:items-stretch">
        {/* Colonne gauche — contenu réel de l'espace + CTA */}
        <div className="glass-surface flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--glass-ink-faint)]">
              Inclus dans l&apos;espace
            </p>
            <h3 className="text-[17px] font-bold tracking-tight">
              Tout ce qu&apos;il faut, au même endroit
            </h3>
          </div>

          <ul className="flex flex-col gap-3.5">
            {SPACE_FEATURES.map(({ Icon, title, desc }) => (
              <li key={title} className="flex items-start gap-3">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background:
                      "color-mix(in oklab, var(--glass-accent-a) 16%, var(--glass-surface))",
                    color: "var(--glass-accent-deep)",
                  }}
                >
                  <Icon className="size-4" strokeWidth={2.2} />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[13.5px] font-bold tracking-tight">
                    {title}
                  </span>
                  <span className="text-[12px] leading-[1.5] text-[color:var(--glass-ink-soft)]">
                    {desc}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-auto flex flex-col gap-2.5 pt-2">
            <Link
              href="/inscription/partenaire"
              className="glass-cta inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[13.5px] font-bold"
            >
              Créer mon espace
              <ArrowRightIcon className="size-4" strokeWidth={2.4} />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] px-5 py-3 text-[13px] font-semibold text-[color:var(--glass-ink-soft)] transition hover:bg-white/55 hover:text-[color:var(--glass-ink)] motion-reduce:transition-none dark:hover:bg-white/10"
            >
              Demander une démo guidée
            </Link>
          </div>
        </div>

        {/* Colonne droite — aperçu à onglets */}
        <div className="glass-surface flex flex-col gap-4 p-4 sm:p-6">
          <div
            role="tablist"
            aria-label="Aperçus de l'espace partenaire"
            onKeyDown={handleTablistKeyDown}
            className="flex flex-wrap items-center gap-1 self-start rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-surface)] p-1 sm:rounded-full"
          >
            {TABS.map(({ key, label, Icon }, index) => {
              const selected = key === active;
              return (
                <button
                  key={key}
                  ref={(node) => {
                    tabRefs.current[index] = node;
                  }}
                  type="button"
                  role="tab"
                  id={`${baseId}-tab-${key}`}
                  aria-selected={selected}
                  aria-controls={`${baseId}-panel-${key}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(key)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-bold transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--glass-accent-deep)] focus-visible:outline-none motion-reduce:transition-none ${
                    selected
                      ? ""
                      : "text-[color:var(--glass-ink-soft)] hover:bg-white/45 hover:text-[color:var(--glass-ink)] dark:hover:bg-white/10"
                  }`}
                  style={selected ? GLASS_PRIMARY_STYLE : undefined}
                >
                  <Icon className="size-3.5" strokeWidth={2.4} />
                  {label}
                </button>
              );
            })}
          </div>

          {/* La clé force le remontage à chaque changement d'onglet → l'entrée
              fadeInUp (.outils-rise) rejoue. Neutralisé par prefers-reduced-motion
              (globals.css + utilitaire motion-reduce). */}
          <div
            key={active}
            role="tabpanel"
            id={`${baseId}-panel-${active}`}
            aria-labelledby={`${baseId}-tab-${active}`}
            className="outils-rise flex min-h-[300px] flex-col gap-4 motion-reduce:animate-none"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[15px] font-bold tracking-tight">
                {activeTab.panelTitle}
              </h3>
              <span
                className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]"
                style={GLASS_POP_STYLE}
              >
                Aperçu — données fictives
              </span>
            </div>
            {active === "agenda" && <AgendaMock />}
            {active === "agr" && <AgrMock />}
            {active === "lookup" && <LookupMock />}
          </div>

          <p className="text-[11px] text-[color:var(--glass-ink-faint)]">
            Maquette d&apos;illustration&nbsp;: les rendez-vous, montants et
            codes affichés sont fictifs.
          </p>
        </div>
      </div>
    </section>
  );
}
