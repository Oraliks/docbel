import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  ClipboardList,
  FileText,
  BookOpen,
  Calculator,
  Users,
  BarChart3,
  Settings,
  Search,
  CircleHelp,
  Bell,
  ChevronDown,
  Send,
  UserPlus,
  Download,
  CalendarDays,
  CalendarClock,
  TriangleAlert,
  FileCheck2,
  FolderKanban,
  Check,
  Scale,
  Headphones,
  ArrowRight,
} from "lucide-react";
import { getEmployerPageUser } from "@/lib/employeur/page-auth";
import { listScenariosForUser } from "@/lib/employeur/queries";
import { estimateEmployerCost } from "@/lib/employeur/cost/engine";
import { labelWorkerType } from "@/lib/employeur/constants";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Tableau de bord | Espace Employeur",
  description: "Gérez vos obligations sociales en toute sérénité.",
};

export const dynamic = "force-dynamic";

const eur = (n: number) =>
  `${n.toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

// --- Données factices (à brancher — voir gap list / mémoire) ----------------
const MOCK_DEADLINES = [
  { day: "16", month: "MAI", title: "ONSS – DMFA", sub: "Déclaration mensuelle – Avr. 2024", tag: "Urgent", tone: "danger" },
  { day: "20", month: "MAI", title: "Précompte professionnel", sub: "Paiement – Mai 2024", tag: "Dans 3 j", tone: "warn" },
  { day: "24", month: "MAI", title: "Assurance accidents du travail", sub: "Déclaration annuelle 2023", tag: "Dans 7 j", tone: "info" },
  { day: "31", month: "MAI", title: "Fiche 281.10", sub: "Envoi annuel", tag: "Dans 14 j", tone: "muted" },
];
const MOCK_ALERTS = [
  { icon: TriangleAlert, title: "3 fiches employé incomplètes", sub: "Des informations manquent pour finaliser le dossier.", cta: "Compléter", tone: "danger" },
  { icon: CalendarClock, title: "Contrat à durée déterminée arrivant à échéance", sub: "2 contrats arrivent à échéance dans les 30 prochains jours.", cta: "Voir les contrats", tone: "warn" },
  { icon: FileCheck2, title: "Document en attente de signature", sub: "Contrat de travail – Martin De Witte", cta: "Ouvrir", tone: "info" },
];
const MOCK_DOSSIERS = [
  { name: "Martin De Witte", role: "Employé", status: "En préparation", date: "14/05/2024", tone: "prep" },
  { name: "Claire Dubois", role: "Employée", status: "Actif", date: "13/05/2024", tone: "active" },
  { name: "Julien Peeters", role: "Employé", status: "En attente", date: "11/05/2024", tone: "wait" },
  { name: "Sophie Lambert", role: "Employée", status: "Actif", date: "08/05/2024", tone: "active" },
  { name: "Thomas Janssens", role: "Employé", status: "En préparation", date: "06/05/2024", tone: "prep" },
];
const STEPS = [
  "Informations employé",
  "Conditions de travail",
  "Rémunération",
  "Avantages & primes",
  "Documents",
  "Vérification & envoi",
];
const MOCK_ACTIVITY = [
  { icon: FileText, text: "Document généré", detail: "Fvril 2024 – Claire Dubois", when: "Aujourd'hui à 09:12" },
  { icon: Send, text: "Document envoyé", detail: "Contrat de travail – Martin De Witte", when: "Hier à 16:45" },
  { icon: CalendarDays, text: "Échéance créée", detail: "ONSS – DMFA – Mai 2024", when: "Hier à 11:08" },
  { icon: UserPlus, text: "Employé ajouté", detail: "Thomas Janssens", when: "13/05/2024 à 10:22" },
];

const NAV = [
  { label: "Tableau de bord", href: "/employeur", icon: LayoutDashboard, active: true },
  { label: "Mes dossiers", href: "/employeur/dossiers", icon: FolderOpen },
  { label: "Engagements", href: "/employeur/nouveau-dossier", icon: ClipboardList },
  { label: "Documents", href: "/employeur/documents", icon: FileText, caret: true },
  { label: "Bibliothèque", href: "/employeur/bibliotheque", icon: BookOpen, caret: true },
  { label: "Simulateurs", href: "/employeur/simulateur-cout", icon: Calculator, caret: true },
  { label: "Employés", href: "#", icon: Users, mock: true },
  { label: "Rapports & exports", href: "#", icon: BarChart3, mock: true },
  { label: "Paramètres", href: "#", icon: Settings, mock: true },
];
const QUICK = [
  { label: "Simuler un coût", sub: "Estimer le coût d'un engagement", href: "/employeur/simulateur-cout", icon: Calculator },
  { label: "Préparer un engagement", sub: "Créer un contrat de travail", href: "/employeur/nouveau-dossier", icon: ClipboardList },
  { label: "Envoyer un document", sub: "Transmettre à Docbel", href: "/employeur/documents", icon: Send },
  { label: "Créer un employé", sub: "Ajouter un collaborateur", href: "#", icon: UserPlus },
  { label: "Télécharger une attestation", sub: "Fiches, ONSS, fiscales…", href: "#", icon: Download },
  { label: "Consulter le calendrier", sub: "Toutes vos échéances", href: "#", icon: CalendarDays },
];

const TAG_TONE: Record<string, string> = {
  danger: "bg-red-500/15 text-red-300 ring-1 ring-red-500/30",
  warn: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
  info: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30",
  muted: "bg-white/10 text-slate-300",
  active: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
  prep: "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30",
  wait: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
};

const CARD = "rounded-2xl border border-white/10 bg-white/[0.035] backdrop-blur-sm";

function SectionHead({ title, action }: { title: string; action?: string }) {
  return (
    <div className="flex items-center justify-between px-5 pt-4">
      <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
      {action ? (
        <span className="flex items-center gap-1 text-xs text-violet-300/80">
          {action} <ArrowRight className="size-3" />
        </span>
      ) : null}
    </div>
  );
}

export default async function EmployeurDashboard() {
  const user = await getEmployerPageUser();
  if (!user) redirect("/p/employeur");

  const scenarios = await listScenariosForUser(user.id);
  const activeCount = scenarios.length;

  // Simulateur RÉEL (moteur Module 2) pour 3 000 € employé temps plein.
  const sim = estimateEmployerCost({
    grossMonthlySalary: 3000,
    regime: "temps_plein",
    workerType: "employe",
    contractType: "cdi",
    jointCommitteeNumber: "200",
  });
  const brut = 3000;
  const cotis = sim.estimatedEmployerContributions;
  const total = sim.estimatedMonthlyEmployerCost;
  const autres = Math.max(0, Math.round((total - brut - cotis) * 100) / 100);
  const pct = (x: number) => (total > 0 ? (x / total) * 100 : 0);
  const pBrut = pct(brut);
  const pCotis = pct(cotis);
  const donut = `conic-gradient(#6366f1 0 ${pBrut}%, #a855f7 ${pBrut}% ${pBrut + pCotis}%, #ec4899 ${pBrut + pCotis}% 100%)`;

  const recent = activeCount
    ? scenarios.slice(0, 5).map((s) => ({
        name: s.title,
        role: labelWorkerType(s.workerType),
        status: "Actif",
        date: new Date(s.updatedAt).toLocaleDateString("fr-BE"),
        tone: "active",
      }))
    : MOCK_DOSSIERS;

  return (
    <div className="flex min-h-svh bg-[#080814] text-slate-200">
      {/* ============================ SIDEBAR ============================ */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-white/10 bg-[#0a0a18] lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
            <FolderKanban className="size-5" />
          </span>
          <div className="leading-tight">
            <p className="text-base font-bold text-white">Docbel</p>
            <p className="text-[10px] uppercase tracking-wider text-violet-300/70">Espace employeur</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
              <Link
                key={n.label}
                href={n.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm no-underline transition-colors",
                  n.active
                    ? "bg-violet-500/15 font-medium text-white ring-1 ring-violet-500/30"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                )}
              >
                <Icon className="size-[18px]" />
                <span className="flex-1">{n.label}</span>
                {n.caret ? <ChevronDown className="size-4 opacity-50" /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 p-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-sm font-medium text-slate-100">Besoin d&apos;aide ?</p>
            <p className="mt-1 text-xs text-slate-400">
              Nos conseillers sont disponibles du lundi au vendredi de 8h30 à 17h.
            </p>
            <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-violet-500/20 py-2 text-xs font-medium text-violet-200 ring-1 ring-violet-500/30">
              <Headphones className="size-3.5" /> Contacter le support
            </button>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs">
            <p className="font-semibold text-slate-200">DOCBEL SRL</p>
            <p className="text-slate-500">Secrétariat social agréé</p>
            <p className="text-slate-500">N° d&apos;agrément 11111</p>
            <span className="mt-1 inline-flex items-center gap-1 text-violet-300/80">
              Voir nos agréments <ArrowRight className="size-3" />
            </span>
          </div>
        </div>
      </aside>

      {/* ============================ MAIN ============================ */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="flex items-center gap-4 border-b border-white/10 px-6 py-3.5">
          <div className="flex max-w-md flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-400">
            <Search className="size-4" />
            <span className="flex-1">Rechercher (dossier, employé, document…)</span>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">⌘K</kbd>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <span className="hidden items-center gap-1.5 text-sm text-slate-300 sm:flex">
              <CircleHelp className="size-4" /> Aide
            </span>
            <span className="relative">
              <Bell className="size-5 text-slate-300" />
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-violet-500 text-[10px] font-bold text-white">
                3
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-bold text-white">
                O
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-sm font-medium text-slate-100">Oraliks SRL</span>
                <span className="block text-[11px] text-slate-500">BE 0641.837.230</span>
              </span>
              <ChevronDown className="size-4 text-slate-500" />
            </span>
          </div>
        </header>

        <main className="flex-1 space-y-6 p-6 duration-500 animate-in fade-in">
          {/* Greeting */}
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="text-2xl font-bold text-white">Bonjour, Sophie 👋</h1>
              <p className="text-sm text-slate-400">
                Gérez vos obligations sociales en toute sérénité. Docbel est à vos côtés.
              </p>
            </div>
            <p className="text-xs text-slate-500">Dernière connexion : aujourd&apos;hui à 09:18</p>
          </div>

          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi icon={FolderOpen} tone="violet" value={String(activeCount || 24)} label="Dossiers actifs" sub="+3 ce mois ↗" />
            <Kpi icon={CalendarClock} tone="sky" value="5" label="Échéances cette semaine" sub="Voir le calendrier" />
            <Kpi icon={FileCheck2} tone="emerald" value="12" label="Documents prêts" sub="À envoyer / télécharger" />
            <Kpi icon={TriangleAlert} tone="red" value="3" label="Alertes" sub="Actions requises" />
          </div>

          {/* Row 1: quick actions / cost sim / deadlines */}
          <div className="grid gap-4 xl:grid-cols-3">
            {/* Quick actions */}
            <div className={CARD}>
              <SectionHead title="Actions rapides" />
              <div className="grid grid-cols-2 gap-3 p-5 pt-3">
                {QUICK.map((q) => {
                  const Icon = q.icon;
                  return (
                    <Link
                      key={q.label}
                      href={q.href}
                      className="group flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 no-underline transition-colors hover:border-violet-500/40 hover:bg-violet-500/5"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-100">{q.label}</span>
                        <span className="block truncate text-xs text-slate-500">{q.sub}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Cost simulator (real engine) */}
            <div className={CARD}>
              <SectionHead title="Simulateur de coût – engagement" />
              <div className="space-y-4 p-5 pt-3">
                <div className="flex rounded-lg bg-white/5 p-1 text-xs">
                  <span className="flex-1 rounded-md bg-violet-500/30 py-1.5 text-center font-medium text-white">Employé</span>
                  <span className="flex-1 py-1.5 text-center text-slate-400">Indépendant</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Régime de travail" value="Temps plein" caret />
                  <Field label="Salaire brut mensuel" value="3.000 €" />
                </div>
                <div className="flex items-center gap-5">
                  <div className="relative size-32 shrink-0 rounded-full" style={{ background: donut }}>
                    <div className="absolute inset-[10px] flex flex-col items-center justify-center rounded-full bg-[#0b0b1c] text-center">
                      <span className="text-[10px] text-slate-400">Coût total estimé</span>
                      <span className="text-base font-bold text-white">{eur(total)}</span>
                      <span className="text-[10px] text-slate-500">/ mois</span>
                    </div>
                  </div>
                  <ul className="flex-1 space-y-1.5 text-xs">
                    <Legend color="#6366f1" label="Salaire brut" value={eur(brut)} />
                    <Legend color="#a855f7" label="Cotisations patronales" value={eur(cotis)} />
                    <Legend color="#ec4899" label="Autres coûts" value={eur(autres)} />
                  </ul>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Index actuel (mai 2024)</span>
                  <span className="text-slate-300">1,9975</span>
                </div>
                <Link
                  href="/employeur/simulateur-cout"
                  className="flex w-full items-center justify-center gap-1 rounded-lg bg-violet-500/20 py-2 text-xs font-medium text-violet-100 no-underline ring-1 ring-violet-500/30"
                >
                  Voir le détail du calcul <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>

            {/* Social deadlines */}
            <div className={CARD}>
              <SectionHead title="Échéances sociales" action="Voir tout" />
              <div className="space-y-2 p-5 pt-3">
                {MOCK_DEADLINES.map((d) => (
                  <div key={d.title} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                    <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-white/5">
                      <span className="text-sm font-bold text-white">{d.day}</span>
                      <span className="text-[9px] uppercase text-slate-500">{d.month}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-100">{d.title}</p>
                      <p className="truncate text-xs text-slate-500">{d.sub}</p>
                    </div>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", TAG_TONE[d.tone])}>{d.tag}</span>
                  </div>
                ))}
                <p className="pt-1 text-center text-xs text-violet-300/80">Voir le calendrier complet</p>
              </div>
            </div>
          </div>

          {/* Row 2: alerts / recent dossiers / stepper */}
          <div className="grid gap-4 xl:grid-cols-3">
            <div className={CARD}>
              <SectionHead title="Alertes & actions requises" action="Voir tout" />
              <div className="space-y-2 p-5 pt-3">
                {MOCK_ALERTS.map((a) => {
                  const Icon = a.icon;
                  return (
                    <div key={a.title} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                      <Icon className={cn("mt-0.5 size-4 shrink-0", a.tone === "danger" ? "text-red-400" : a.tone === "warn" ? "text-amber-400" : "text-sky-400")} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-100">{a.title}</p>
                        <p className="text-xs text-slate-500">{a.sub}</p>
                      </div>
                      <span className="shrink-0 rounded-lg bg-white/5 px-2 py-1 text-[11px] text-slate-300">{a.cta}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={CARD}>
              <SectionHead title="Mes dossiers récents" action="Voir tous" />
              <div className="divide-y divide-white/5 px-5 pt-2 pb-3">
                {recent.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5">
                    <span className="flex size-8 items-center justify-center rounded-full bg-white/10 text-xs text-slate-300">
                      {d.name.slice(0, 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-100">{d.name}</p>
                      <p className="text-xs text-slate-500">{d.role}</p>
                    </div>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", TAG_TONE[d.tone])}>{d.status}</span>
                    <span className="hidden text-[11px] text-slate-500 sm:block">Mis à jour le {d.date}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={CARD}>
              <div className="flex items-center justify-between px-5 pt-4">
                <h2 className="text-sm font-semibold text-slate-100">Démarrer un engagement</h2>
                <span className="text-xs text-slate-500">Étape 2 sur 6</span>
              </div>
              <div className="space-y-4 p-5 pt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" />
                </div>
                <ol className="space-y-2.5">
                  {STEPS.map((s, i) => {
                    const done = i === 0;
                    const current = i === 1;
                    return (
                      <li key={s} className="flex items-center gap-3 text-sm">
                        <span
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px]",
                            done
                              ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
                              : current
                                ? "bg-violet-500 font-bold text-white"
                                : "bg-white/10 text-slate-500"
                          )}
                        >
                          {done ? <Check className="size-3.5" /> : i + 1}
                        </span>
                        <span className={cn(current ? "font-medium text-slate-100" : done ? "text-slate-300" : "text-slate-500")}>{s}</span>
                      </li>
                    );
                  })}
                </ol>
                <Link
                  href="/employeur/nouveau-dossier"
                  className="flex w-full items-center justify-center gap-1 rounded-lg bg-violet-500/20 py-2 text-xs font-medium text-violet-100 no-underline ring-1 ring-violet-500/30"
                >
                  Continuer <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Row 3: activity / veille */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className={CARD}>
              <SectionHead title="Activité récente" action="Voir toute l'activité" />
              <div className="divide-y divide-white/5 px-5 pt-2 pb-3">
                {MOCK_ACTIVITY.map((a, i) => {
                  const Icon = a.icon;
                  return (
                    <div key={i} className="flex items-center gap-3 py-2.5">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-white/5 text-slate-400">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-200">
                          {a.text} <span className="text-slate-500">{a.detail}</span>
                        </p>
                      </div>
                      <span className="text-[11px] text-slate-500">{a.when}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={CARD}>
              <SectionHead title="Veille & conformité" action="Voir toute la veille" />
              <div className="flex items-start gap-4 p-5 pt-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>10/05/2024</span>
                    <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] text-violet-300 ring-1 ring-violet-500/30">
                      Législation
                    </span>
                  </div>
                  <p className="mt-1 font-medium text-slate-100">Indexation des salaires au 1er mai 2024</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Les salaires et avantages ont été indexés conformément à l&apos;indice santé lissé.
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs text-violet-300/80">
                    Lire la suite <ArrowRight className="size-3" />
                  </span>
                </div>
                <span className="flex size-12 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
                  <Scale className="size-6" />
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  tone,
  value,
  label,
  sub,
}: {
  icon: typeof FolderOpen;
  tone: "violet" | "sky" | "emerald" | "red";
  value: string;
  label: string;
  sub: string;
}) {
  const tones: Record<string, string> = {
    violet: "bg-violet-500/15 text-violet-300",
    sky: "bg-sky-500/15 text-sky-300",
    emerald: "bg-emerald-500/15 text-emerald-300",
    red: "bg-red-500/15 text-red-300",
  };
  return (
    <div className={cn(CARD, "flex items-center justify-between p-5")}>
      <div>
        <p className="text-sm text-slate-400">{label}</p>
        <p className="mt-1 text-3xl font-bold text-white">{value}</p>
        <p className="mt-1 text-xs text-slate-500">{sub}</p>
      </div>
      <span className={cn("flex size-12 items-center justify-center rounded-2xl", tones[tone])}>
        <Icon className="size-6" />
      </span>
    </div>
  );
}

function Field({ label, value, caret }: { label: string; value: string; caret?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-[11px] text-slate-500">{label}</p>
      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-200">
        <span>{value}</span>
        {caret ? <ChevronDown className="size-4 text-slate-500" /> : null}
      </div>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="flex-1 text-slate-400">{label}</span>
      <span className="font-medium text-slate-200">{value}</span>
    </li>
  );
}
