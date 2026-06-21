"use client";

/// Shell de l'éditeur d'arbre — 5 onglets calqués sur pdf-form-editor.tsx :
/// Arbre / Détails / Tester / Validation / Publication. Topbar sticky avec
/// statut, auto-save, valider, historique, publier.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  History,
  Loader2,
  Plus,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addRootQuestion } from "@/lib/decision-builder/mutations";
import type { ValidationReport, Violation } from "@/lib/decision-builder/validator";
import type { DecisionTreeContent } from "@/lib/decision-builder/types";
import { DecisionCanvas } from "./canvas";
import { NodeInspector } from "./node-inspector";
import { SimulationPanel } from "./simulation-panel";
import { VersionsDialog } from "./versions-dialog";
import { useTreeData } from "./use-tree-data";

export function TreeEditor({ treeId }: { treeId: string }) {
  const router = useRouter();
  const data = useTreeData(treeId);
  const { meta, content, saving, busy, report } = data;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState("arbre");
  const [changeNotes, setChangeNotes] = useState("");
  const [versionsOpen, setVersionsOpen] = useState(false);

  const violations = useMemo(() => violationMap(report), [report]);

  if (!meta || !content) {
    return (
      <div className="space-y-3 p-6">
        <div className="h-9 w-64 animate-pulse rounded bg-muted" />
        <div className="h-96 w-full animate-pulse rounded bg-muted" />
      </div>
    );
  }

  function setContent(next: DecisionTreeContent) {
    data.setContent(next);
  }

  async function handleValidate() {
    const r = await data.validate();
    if (r) setTab(r.publishable ? "publication" : "validation");
  }

  const statusBadge =
    meta.status === "published"
      ? { label: "Publié", variant: "default" as const }
      : meta.status === "archived"
        ? { label: "Archivé", variant: "outline" as const }
        : { label: "Brouillon", variant: "secondary" as const };

  return (
    <div className="flex h-[calc(100svh-1px)] flex-col">
      {/* Topbar */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <button
          onClick={() => router.push("/admin/decision-trees")}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Arbres
        </button>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">{meta.title}</span>
        <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
        <span className="ml-1 text-xs text-muted-foreground">
          {saving ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" /> Enregistrement…
            </span>
          ) : (
            "Enregistré"
          )}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleValidate} disabled={busy === "validate"}>
            {busy === "validate" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            Valider
          </Button>
          <Button variant="outline" size="sm" onClick={() => setVersionsOpen(true)}>
            <History className="size-4" /> Historique
          </Button>
          {meta.status === "published" ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => data.unpublish()}
              disabled={busy === "unpublish"}
            >
              Dépublier
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => setTab("publication")}
            >
              <UploadCloud className="size-4" /> Publier…
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList variant="line" className="justify-start rounded-none border-b px-4">
          <TabsTrigger value="arbre">Arbre</TabsTrigger>
          <TabsTrigger value="details">Détails</TabsTrigger>
          <TabsTrigger value="test">Tester</TabsTrigger>
          <TabsTrigger value="validation">
            Validation
            {violations.size > 0 && (
              <span className="ml-1.5 rounded-full bg-red-500/15 px-1.5 text-[10px] font-bold text-red-600 dark:text-red-400">
                {report?.errors.length ?? 0}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="publication">Publication</TabsTrigger>
        </TabsList>

        {/* Onglet ARBRE : canvas + inspecteur */}
        <TabsContent value="arbre" className="min-h-0 flex-1">
          <div className="grid h-full grid-cols-[1fr_360px]">
            <div className="relative min-h-0 border-r bg-muted/20">
              <div className="absolute left-3 top-3 z-10">
                {!content.rootNodeId && (
                  <Button
                    size="sm"
                    onClick={() => {
                      const { content: next, id } = addRootQuestion(content);
                      setContent(next);
                      setSelectedId(id);
                    }}
                  >
                    <Plus className="size-4" /> Question racine
                  </Button>
                )}
              </div>
              <DecisionCanvas
                content={content}
                selectedId={selectedId}
                onSelect={setSelectedId}
                violations={violations}
              />
            </div>
            <NodeInspector
              content={content}
              selectedId={selectedId}
              onChange={setContent}
              onSelect={setSelectedId}
            />
          </div>
        </TabsContent>

        {/* Onglet DÉTAILS */}
        <TabsContent value="details" className="flex-1 overflow-y-auto p-6">
          <div className="max-w-xl space-y-4">
            <div className="space-y-1.5">
              <Label>Titre</Label>
              <Input
                value={meta.title}
                onChange={(e) => data.patchMeta({ title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={meta.description ?? ""}
                onChange={(e) => data.patchMeta({ description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Segment</Label>
                <Input
                  value={meta.segment}
                  onChange={(e) => data.patchMeta({ segment: e.target.value })}
                  placeholder="chomage"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Slug</Label>
                <Input value={meta.slug} disabled className="font-mono text-xs" />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Onglet TESTER */}
        <TabsContent value="test" className="min-h-0 flex-1 overflow-y-auto">
          <SimulationPanel content={content} />
        </TabsContent>

        {/* Onglet VALIDATION */}
        <TabsContent value="validation" className="flex-1 overflow-y-auto p-6">
          <ValidationTab
            report={report}
            onValidate={handleValidate}
            busy={busy === "validate"}
            onPick={(nodeId) => {
              if (nodeId) setSelectedId(nodeId);
              setTab("arbre");
            }}
          />
        </TabsContent>

        {/* Onglet PUBLICATION */}
        <TabsContent value="publication" className="flex-1 overflow-y-auto p-6">
          <div className="max-w-xl space-y-4">
            <PublishSummary report={report} />
            <div className="space-y-1.5">
              <Label>Note de version (optionnel)</Label>
              <Textarea
                value={changeNotes}
                onChange={(e) => setChangeNotes(e.target.value)}
                rows={2}
                placeholder="Ex. ajout de la branche frontalier"
              />
            </div>
            <Button
              onClick={async () => {
                const ok = await data.publish(changeNotes || undefined);
                if (ok) setChangeNotes("");
              }}
              disabled={busy === "publish" || (report ? !report.publishable : false)}
            >
              {busy === "publish" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Publier cette version
            </Button>
            {report && !report.publishable && (
              <p className="text-sm text-red-600 dark:text-red-400">
                Corrigez les {report.errors.length} erreur(s) avant de publier.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <VersionsDialog
        treeId={treeId}
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        onRestored={() => {
          data.load();
          setSelectedId(null);
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ValidationTab({
  report,
  onValidate,
  busy,
  onPick,
}: {
  report: ValidationReport | null;
  onValidate: () => void;
  busy: boolean;
  onPick: (nodeId?: string) => void;
}) {
  if (!report) {
    return (
      <div className="max-w-xl space-y-3 text-center">
        <p className="text-sm text-muted-foreground">
          Lancez la validation pour détecter branches cassées, résultats sans
          dossier et formulaires manquants.
        </p>
        <Button onClick={onValidate} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          Valider l'arbre
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        {report.publishable ? (
          <Badge className="gap-1">
            <CheckCircle2 className="size-3.5" /> Publiable
          </Badge>
        ) : (
          <Badge variant="destructive" className="gap-1">
            <TriangleAlert className="size-3.5" /> {report.errors.length} erreur(s)
          </Badge>
        )}
        <Button variant="outline" size="sm" onClick={onValidate} disabled={busy}>
          <RotateCcw className="size-3.5" /> Revalider
        </Button>
      </div>

      <ViolationList
        title="Erreurs (bloquent la publication)"
        items={report.errors}
        tone="error"
        onPick={onPick}
      />
      <ViolationList
        title="Avertissements"
        items={report.warnings}
        tone="warning"
        onPick={onPick}
      />
      {report.violations.length === 0 && (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          Aucun problème détecté. 🎉
        </p>
      )}
    </div>
  );
}

function ViolationList({
  title,
  items,
  tone,
  onPick,
}: {
  title: string;
  items: Violation[];
  tone: "error" | "warning";
  onPick: (nodeId?: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {title} ({items.length})
      </p>
      <ul className="space-y-1">
        {items.map((v, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onPick(v.nodeId)}
              className={cnTone(tone)}
            >
              <span className="flex-1">{v.message}</span>
              {v.nodeId && (
                <span className="font-mono text-[11px] opacity-60">{v.nodeId}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function cnTone(tone: "error" | "warning"): string {
  return [
    "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition hover:bg-accent/40",
    tone === "error"
      ? "border-red-500/30 bg-red-500/5"
      : "border-amber-500/30 bg-amber-500/5",
  ].join(" ");
}

function PublishSummary({ report }: { report: ValidationReport | null }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm font-medium">Validation avant publication</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {report == null
          ? "La validation sera relancée automatiquement à la publication."
          : report.publishable
            ? `Prêt à publier${report.warnings.length ? ` (${report.warnings.length} avertissement(s) non bloquant(s))` : ""}.`
            : `${report.errors.length} erreur(s) à corriger.`}
      </p>
    </div>
  );
}

function violationMap(report: ValidationReport | null): Map<string, "error" | "warning"> {
  const m = new Map<string, "error" | "warning">();
  if (!report) return m;
  for (const w of report.warnings) if (w.nodeId) m.set(w.nodeId, "warning");
  for (const e of report.errors) if (e.nodeId) m.set(e.nodeId, "error"); // error écrase warning
  return m;
}
