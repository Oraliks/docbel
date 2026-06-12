"use client";

// ============================================================================
// Échéancier des obligations employeur — landing /p/employeur.
//
// ⚠️ CONTENU À VALIDER PAR L'EXPERT (Oraliks) : les formulations sont
// volontairement prudentes et génériques, dérivées des textes internes du
// repo (lib/dossiers/chomage-temporaire/{index,procedures}.ts et
// lib/dossiers/chomage-complet/index.ts). Aucun délai chiffré réglementaire
// n'est affirmé au-delà de ce que ces sources décrivent.
//
// L'export .ics est généré CÔTÉ CLIENT (Blob), sans appel API : la route
// /api/export-ics existante est privée (garde partenaire/admin). Les helpers
// de format (échappement, pliage 75 octets, VTIMEZONE Europe/Brussels) sont
// repris de lib/rendez-vous/ics.ts — non exportés là-bas, recopiés ici à
// l'identique pour rester conformes RFC 5545.
// ============================================================================

import { useEffect, useRef, useState } from "react";
import {
  ArchiveIcon,
  CalendarPlusIcon,
  CheckIcon,
  FileCheckIcon,
  FileTextIcon,
  type LucideIcon,
  MegaphoneIcon,
  SendIcon,
} from "lucide-react";
import { GLASS_POP_STYLE } from "@/lib/glass-classes";

// ── Pastilles d'icônes — mêmes dégradés que la landing employeur ────────────
// (constantes locales à app/p/employeur/page.tsx, recopiées pour cohérence).
type IconHue = "violet" | "orange" | "rose" | "blue" | "green" | "mauve";
const ICON_BG: Record<IconHue, string> = {
  violet: "linear-gradient(135deg, var(--glass-accent-a), var(--glass-accent-deep))",
  orange: "linear-gradient(135deg, var(--glass-accent-d), #FF8050)",
  rose: "linear-gradient(135deg, var(--glass-accent-c), #E060A0)",
  blue: "linear-gradient(135deg, #80B0FF, #5060FF)",
  green: "linear-gradient(135deg, #80E0C0, #40C0A0)",
  mauve: "linear-gradient(135deg, #D08CFF, var(--glass-accent-a))",
};
const ICON_SHADOW: Record<IconHue, string> = {
  violet: "0 6px 20px rgba(159,124,255,0.35)",
  orange: "0 6px 20px rgba(255,176,112,0.35)",
  rose: "0 6px 20px rgba(255,140,192,0.35)",
  blue: "0 6px 20px rgba(128,176,255,0.35)",
  green: "0 6px 20px rgba(128,224,192,0.35)",
  mauve: "0 6px 20px rgba(208,140,255,0.30)",
};

interface Obligation {
  Icon: LucideIcon;
  hue: IconHue;
  /** Repère temporel affiché en pastille ("Avant la suspension", "Mensuel"…). */
  moment: string;
  title: string;
  desc: string;
}

// Obligations récurrentes autour du chômage temporaire et de la fin de
// contrat. Sources internes : lib/dossiers/chomage-temporaire (notification,
// communication 1er jour, DRS/WECH, C3.2A) et chomage-complet (C4).
const OBLIGATIONS: Obligation[] = [
  {
    Icon: SendIcon,
    hue: "violet",
    moment: "Avant la suspension",
    title: "Notifier le chômage temporaire à l'ONEM",
    desc: "Pour le chômage économique et la suspension employés, la période prévue se notifie à l'ONEM avant le début de la suspension. Les intempéries, elles, ne demandent pas de notification préalable.",
  },
  {
    Icon: FileTextIcon,
    hue: "blue",
    moment: "Dès le 1ᵉʳ jour",
    title: "Remettre la carte de contrôle au travailleur",
    desc: "Chaque travailleur concerné reçoit sa carte de contrôle (C3.2A) dès le premier jour de chômage effectif du mois — elle conditionne le paiement de ses allocations.",
  },
  {
    Icon: MegaphoneIcon,
    hue: "orange",
    moment: "Chaque mois concerné",
    title: "Communiquer le 1ᵉʳ jour effectif de chômage",
    desc: "Économique, intempéries, accident technique ou suspension employés : le premier jour effectif de chômage du mois se communique à l'ONEM, en règle générale le jour même ou un jour ouvrable autour (variantes selon le motif).",
  },
  {
    Icon: CalendarPlusIcon,
    hue: "green",
    moment: "Chaque fin de mois",
    title: "Déclarer les heures de chômage temporaire (DRS)",
    desc: "La déclaration électronique DRS (flux WECH) part via le portail de la sécurité sociale en fin de mois : c'est elle qui permet le calcul et le paiement des allocations de vos travailleurs.",
  },
  {
    Icon: FileCheckIcon,
    hue: "rose",
    moment: "À chaque fin de contrat",
    title: "Remettre le C4 au travailleur",
    desc: "Le certificat de chômage C4 atteste les périodes de travail et le motif de la fin de contrat. Le travailleur en a besoin rapidement pour faire valoir ses droits auprès de son organisme de paiement.",
  },
  {
    Icon: ArchiveIcon,
    hue: "mauve",
    moment: "En continu",
    title: "Conserver déclarations et justificatifs",
    desc: "Notifications, communications, déclarations et documents remis : conservez-en la trace. En cas de contrôle ou de litige, ces justificatifs font foi.",
  },
];

// ── Génération .ics (RFC 5545) — helpers repris de lib/rendez-vous/ics.ts ──

const TZID = "Europe/Brussels";
const PRODID = "-//DocBel//Echeancier Employeur//FR";
const MAX_LINE_OCTETS = 75;

// VTIMEZONE standard Europe/Bruxelles (CET/CEST, bascule dernier dimanche de
// mars / octobre) — identique au bloc émis par lib/rendez-vous/ics.ts.
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${TZID}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Échappement des valeurs texte (RFC 5545 §3.3.11) : \ , ; et sauts de ligne. */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\n|\r/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

/** Pliage RFC 5545 §3.1 : aucune ligne physique > 75 octets (UTF-8). */
function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= MAX_LINE_OCTETS) return line;
  let result = "";
  let lineBytes = 0;
  for (const char of line) {
    const charBytes = encoder.encode(char).length;
    if (lineBytes + charBytes > MAX_LINE_OCTETS) {
      result += "\r\n "; // CRLF + espace = ligne de continuation
      lineBytes = 1; // l'espace de continuation compte dans la ligne suivante
    }
    result += char;
    lineBytes += charBytes;
  }
  return result;
}

interface MonthlyReminder {
  /** UID stable : ré-importer le fichier met à jour l'événement au lieu de le dupliquer. */
  uid: string;
  /** Jour du mois du rappel (1-28 pour exister tous les mois). */
  byMonthDay: number;
  /** Heure murale Europe/Bruxelles (rappel de 30 minutes). */
  hour: number;
  summary: string;
  description: string;
}

// ⚠️ CONTENU À VALIDER PAR L'EXPERT : rappels génériques « bonnes pratiques »,
// à adapter par chaque employeur à sa situation (motif, secteur, secrétariat
// social). Les jours choisis (1, 25, 28) sont indicatifs, pas réglementaires.
const REMINDERS: MonthlyReminder[] = [
  {
    uid: "rappel-employeur-ct-jour1@docbel.be",
    byMonthDay: 1,
    hour: 9,
    summary:
      "Chômage temporaire : communiquer le 1er jour effectif à l'ONEM",
    description:
      "Si du chômage temporaire est prévu ce mois-ci : communiquez le premier jour effectif à l'ONEM et vérifiez que chaque travailleur a reçu sa carte de contrôle (C3.2A). Rappel indicatif créé par Docbel — à adapter à votre situation.",
  },
  {
    uid: "rappel-employeur-ct-drs@docbel.be",
    byMonthDay: 25,
    hour: 9,
    summary:
      "Préparer la déclaration des heures de chômage temporaire (DRS)",
    description:
      "Préparez la déclaration électronique de fin de mois (DRS / WECH) via le portail de la sécurité sociale : elle sert au paiement des allocations de vos travailleurs. Rappel indicatif créé par Docbel.",
  },
  {
    uid: "rappel-employeur-ct-cloture@docbel.be",
    byMonthDay: 28,
    hour: 14,
    summary:
      "Clôture sociale du mois : déclarations transmises, justificatifs archivés",
    description:
      "Vérifiez que les déclarations du mois sont bien parties et archivez notifications, communications et justificatifs. Rappel indicatif créé par Docbel.",
  },
];

/** Horodatage UTC absolu pour DTSTAMP (YYYYMMDDTHHMMSSZ). */
function formatUtcStamp(date: Date): string {
  return (
    String(date.getUTCFullYear()).padStart(4, "0") +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

/**
 * Construit le VCALENDAR complet : un VEVENT récurrent mensuel
 * (RRULE:FREQ=MONTHLY;BYMONTHDAY=…) par rappel, DTSTART au mois prochain en
 * heure murale bruxelloise (TZID + VTIMEZONE — le client calendrier gère le
 * passage heure d'été/hiver), CRLF + pliage 75 octets conformes RFC 5545.
 */
function buildEmployerIcs(now: Date): string {
  // Premier mois couvert = le mois CIVIL suivant (rappels « à partir du mois
  // prochain », pour ne pas créer d'événements déjà passés ce mois-ci).
  const nextMonthIndex = now.getMonth() + 1; // peut déborder : géré par l'arithmétique ci-dessous
  const year = now.getFullYear() + Math.floor(nextMonthIndex / 12);
  const month = (nextMonthIndex % 12) + 1; // 1-12

  const dtstamp = formatUtcStamp(now);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...VTIMEZONE,
  ];

  for (const reminder of REMINDERS) {
    const day = pad(reminder.byMonthDay);
    const start = `${year}${pad(month)}${day}T${pad(reminder.hour)}0000`;
    const end = `${year}${pad(month)}${day}T${pad(reminder.hour)}3000`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${reminder.uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=${TZID}:${start}`,
      `DTEND;TZID=${TZID}:${end}`,
      `RRULE:FREQ=MONTHLY;BYMONTHDAY=${reminder.byMonthDay}`,
      `SUMMARY:${escapeIcsText(reminder.summary)}`,
      `DESCRIPTION:${escapeIcsText(reminder.description)}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  // CRLF obligatoire (RFC 5545 §3.1), terminé par un CRLF final.
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

// ── Composant ────────────────────────────────────────────────────────────────

function IconTile({ Icon, hue }: { Icon: LucideIcon; hue: IconHue }) {
  return (
    <span
      className="flex size-10 items-center justify-center rounded-2xl text-white"
      style={{ backgroundImage: ICON_BG[hue], boxShadow: ICON_SHADOW[hue] }}
    >
      <Icon className="size-[18px]" strokeWidth={2.2} />
    </span>
  );
}

/**
 * Section « Vos obligations, au bon moment » : grille des obligations
 * récurrentes employeur + export client d'un .ics de 3 rappels mensuels.
 * Entrée en scène douce des cartes via IntersectionObserver (callback
 * asynchrone → compatible react-hooks/set-state-in-effect), neutralisée par
 * prefers-reduced-motion (utilitaires motion-reduce:*).
 */
export function EcheancierEmployeur() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [exported, setExported] = useState(false);
  const exportTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      // Fallback : révéler au tick suivant (setState asynchrone — lint OK).
      const timer = window.setTimeout(() => setRevealed(true), 0);
      return () => window.clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Nettoie le timer du feedback « téléchargé » si la page est quittée avant.
  useEffect(() => {
    return () => {
      if (exportTimerRef.current !== null) {
        window.clearTimeout(exportTimerRef.current);
      }
    };
  }, []);

  const handleExport = () => {
    const ics = buildEmployerIcs(new Date());
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "docbel-rappels-employeur.ics";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    setExported(true);
    if (exportTimerRef.current !== null) {
      window.clearTimeout(exportTimerRef.current);
    }
    exportTimerRef.current = window.setTimeout(() => {
      setExported(false);
      exportTimerRef.current = null;
    }, 2600);
  };

  return (
    <section ref={sectionRef} className="flex flex-col gap-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-4">
          <span
            className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em]"
            style={{
              borderColor:
                "color-mix(in oklab, var(--glass-accent-deep) 30%, transparent)",
              background:
                "color-mix(in oklab, var(--glass-accent-a) 12%, var(--glass-surface))",
              color: "var(--glass-accent-deep)",
            }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ background: "var(--glass-accent-deep)" }}
            />
            Échéancier employeur
          </span>
          <h2 className="glass-display max-w-3xl text-[30px] leading-[1.1] font-semibold tracking-tight sm:text-[38px]">
            Vos obligations, <em>au bon moment</em>
          </h2>
          <p className="max-w-[560px] text-[14.5px] leading-[1.6] text-[color:var(--glass-ink-soft)]">
            Le chômage temporaire et la fin de contrat suivent un rythme
            précis. Voici les rendez-vous récurrents à ne pas manquer — et des
            rappels prêts à glisser dans votre agenda.
          </p>
        </div>

        <div className="flex flex-col gap-2 lg:items-end">
          <button
            type="button"
            onClick={handleExport}
            className="glass-cta inline-flex w-fit items-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-bold"
          >
            {exported ? (
              <CheckIcon className="size-4" strokeWidth={2.6} />
            ) : (
              <CalendarPlusIcon className="size-4" strokeWidth={2.4} />
            )}
            {exported
              ? "Rappels téléchargés !"
              : "Ajouter les rappels à mon agenda (.ics)"}
          </button>
          <p className="max-w-[340px] text-[11.5px] leading-[1.5] text-[color:var(--glass-ink-faint)] lg:text-right">
            3 rappels mensuels récurrents, compatibles Outlook, Google Agenda
            et Apple Calendar.
          </p>
        </div>
      </div>

      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {OBLIGATIONS.map(({ Icon, hue, moment, title, desc }, index) => (
          <li
            key={title}
            className={`glass-surface flex flex-col gap-3.5 p-5 transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${
              revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{ transitionDelay: `${index * 70}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <IconTile Icon={Icon} hue={hue} />
              <span
                className="rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.08em]"
                style={GLASS_POP_STYLE}
              >
                {moment}
              </span>
            </div>
            <h3 className="text-[15px] font-bold tracking-tight">{title}</h3>
            <p className="text-[12.5px] leading-[1.55] text-[color:var(--glass-ink-soft)]">
              {desc}
            </p>
          </li>
        ))}
      </ol>

      <p className="text-[12px] leading-[1.55] text-[color:var(--glass-ink-faint)]">
        Aperçu indicatif : les modalités exactes (délais, canaux, formulaires)
        dépendent du motif de chômage temporaire et de votre situation. En cas
        de doute, référez-vous aux instructions officielles de l&apos;ONEM ou à
        votre secrétariat social.
      </p>
    </section>
  );
}
