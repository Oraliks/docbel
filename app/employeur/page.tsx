import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, FolderOpen, Calculator, BookOpen, FileText, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LegalDisclaimerBox } from "@/components/docbel/employeur/legal-disclaimer-box";
import { getEmployerPageUser } from "@/lib/employeur/page-auth";
import { listScenariosForUser } from "@/lib/employeur/queries";
import { labelScenarioStatus, labelWorkerType } from "@/lib/employeur/constants";

export const metadata: Metadata = {
  title: "Espace Employeur | DocBel",
  description: "Comprenez, simulez et préparez vos démarches sociales d'employeur.",
};

export const dynamic = "force-dynamic";

const ACTIONS = [
  {
    href: "/employeur/nouveau-dossier",
    icon: ClipboardList,
    title: "Préparer un engagement",
    desc: "Répondez à quelques questions, obtenez une checklist et des alertes.",
    soon: false,
  },
  {
    href: "/employeur/simulateur-cout",
    icon: Calculator,
    title: "Simuler un coût",
    desc: "Estimer le coût employeur d'un engagement (indicatif).",
    soon: false,
  },
  {
    href: "/employeur/dossiers",
    icon: FolderOpen,
    title: "Mes dossiers",
    desc: "Retrouvez vos scénarios d'engagement et leurs checklists.",
    soon: false,
  },
  {
    href: "/employeur/bibliotheque",
    icon: BookOpen,
    title: "Bibliothèque des démarches",
    desc: "Fiches pédagogiques sur les démarches employeur.",
    soon: false,
  },
  {
    href: "/employeur/documents",
    icon: FileText,
    title: "Préparer un document",
    desc: "Fiche travailleur, demande au secrétariat social, etc.",
    soon: false,
  },
  {
    href: "/employeur/controle",
    icon: ShieldCheck,
    title: "Vérifier une fiche",
    desc: "Détecter des incohérences sur une fiche de paie.",
    soon: false,
  },
];

export default async function EmployeurDashboard() {
  const user = await getEmployerPageUser();
  if (!user) redirect("/p/employeur");

  const scenarios = (await listScenariosForUser(user.id)).slice(0, 5);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Espace Employeur</h1>
        <p className="text-muted-foreground">
          Comprenez, simulez et préparez vos démarches sociales en Belgique.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          const card = (
            <Card className={a.soon ? "opacity-60" : "transition-colors hover:border-primary/40"}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <Icon className="size-5 text-primary" />
                  {a.soon ? <Badge variant="secondary">Bientôt</Badge> : <ArrowRight className="size-4 text-muted-foreground" />}
                </div>
                <CardTitle className="mt-2">{a.title}</CardTitle>
                <CardDescription>{a.desc}</CardDescription>
              </CardHeader>
            </Card>
          );
          return a.soon ? (
            <div key={a.title}>{card}</div>
          ) : (
            <Link key={a.title} href={a.href} className="block no-underline">
              {card}
            </Link>
          );
        })}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Mes dossiers récents</h2>
          <Button variant="ghost" size="sm" render={<Link href="/employeur/dossiers" />}>
            Tout voir
          </Button>
        </div>

        {scenarios.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-muted-foreground">Vous n'avez pas encore de dossier.</p>
              <Button render={<Link href="/employeur/nouveau-dossier" />}>
                Préparer un engagement <ArrowRight />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ul className="divide-y rounded-lg border">
            {scenarios.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/employeur/dossiers/${s.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 no-underline hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {labelWorkerType(s.workerType)} · {s._count.checklists} checklist(s)
                    </p>
                  </div>
                  <Badge variant="outline">{labelScenarioStatus(s.status)}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <LegalDisclaimerBox context="general" />
    </div>
  );
}
