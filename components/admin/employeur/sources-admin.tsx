"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export interface AdminSource {
  id: string;
  code: string;
  title: string;
  institution: string;
  url: string;
  contentSummary: string | null;
  reliability: string | null;
  appliesToModules: string[];
  active: boolean;
  lastCheckedAt: string | null;
}

const ONE_YEAR_MS = 365 * 24 * 3600 * 1000;

function freshness(lastCheckedAt: string | null): { label: string; variant: "success" | "warning" } {
  if (!lastCheckedAt) return { label: "Jamais vérifiée", variant: "warning" };
  const age = Date.now() - new Date(lastCheckedAt).getTime();
  if (age > ONE_YEAR_MS) return { label: "À revérifier", variant: "warning" };
  return { label: `Vérifiée le ${new Date(lastCheckedAt).toLocaleDateString("fr-BE")}`, variant: "success" };
}

export function SourcesAdmin({ sources }: { sources: AdminSource[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    code: "",
    title: "",
    institution: "",
    url: "",
    contentSummary: "",
    reliability: "high",
  });

  async function patch(id: string, body: Record<string, unknown>, okMsg?: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/employeur/sources/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Échec");
      if (okMsg) toast.success(okMsg);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/employeur/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Échec");
      toast.success("Source créée.");
      setForm({ code: "", title: "", institution: "", url: "", contentSummary: "", reliability: "high" });
      setCreating(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating((c) => !c)} variant={creating ? "outline" : "default"}>
          <Plus /> Nouvelle source
        </Button>
      </div>

      {creating ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nouvelle source officielle</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="s-code">Code</Label>
              <Input id="s-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="S14" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-inst">Institution</Label>
              <Input id="s-inst" value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="s-title">Titre</Label>
              <Input id="s-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="s-url">URL</Label>
              <Input id="s-url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="s-sum">Résumé interne</Label>
              <Input id="s-sum" value={form.contentSummary} onChange={(e) => setForm({ ...form, contentSummary: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button variant="ghost" onClick={() => setCreating(false)} disabled={busy}>
                Annuler
              </Button>
              <Button onClick={create} disabled={busy}>
                Créer
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-2">
        {sources.map((s) => {
          const fr = freshness(s.lastCheckedAt);
          return (
            <Card key={s.id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-3 py-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{s.code}</Badge>
                    <span className="font-medium">{s.title}</span>
                    {!s.active ? <Badge variant="secondary">Inactive</Badge> : null}
                    <Badge variant={fr.variant}>{fr.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.institution}</p>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary">
                    {s.url} <ExternalLink className="size-3" />
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-sm">
                    <Checkbox checked={s.active} onCheckedChange={(c) => patch(s.id, { active: c === true })} disabled={busy} />
                    Active
                  </label>
                  <Button size="sm" variant="outline" onClick={() => patch(s.id, { markVerified: true }, "Source marquée comme vérifiée.")} disabled={busy}>
                    <ShieldCheck /> Marquer vérifié
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
