"use client";

/// Liste des arbres d'orientation (admin) + création. Calque forms-list.tsx :
/// server page → composant client qui fetch /api/decision-trees au mount.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, GitBranch, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TreeRow {
  id: string;
  slug: string;
  title: string;
  segment: string;
  status: "draft" | "published" | "archived";
  publishedAt: string | null;
  updatedAt: string;
  _count: { revisions: number };
}

const STATUS_BADGE: Record<
  TreeRow["status"],
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  published: { label: "Publié", variant: "default" },
  draft: { label: "Brouillon", variant: "secondary" },
  archived: { label: "Archivé", variant: "outline" },
};

export function DecisionTreesList() {
  const router = useRouter();
  const [trees, setTrees] = useState<TreeRow[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [segment, setSegment] = useState("chomage");
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    fetch("/api/decision-trees")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setTrees(Array.isArray(d) ? d : []))
      .catch(() => setTrees([]));
  }, []);

  useEffect(() => load(), [load]);

  async function create() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/decision-trees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), segment: segment.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "Échec de la création.");
        return;
      }
      toast.success("Arbre créé.");
      router.push(`/admin/decision-trees/${data.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> Nouvel arbre
        </Button>
      </div>

      {trees === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 w-full animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : trees.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border py-12 text-center">
          <GitBranch className="size-6 text-muted-foreground" />
          <p className="font-medium">Aucun arbre d'orientation</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Créez un arbre pour orienter les utilisateurs vers le bon dossier en
            quelques questions.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titre</TableHead>
                <TableHead className="hidden sm:table-cell">Segment</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="hidden text-right sm:table-cell">
                  Versions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trees.map((t) => {
                const badge = STATUS_BADGE[t.status];
                return (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/admin/decision-trees/${t.id}`)}
                  >
                    <TableCell className="font-medium">{t.title}</TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {t.segment}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">
                      {t._count.revisions}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvel arbre d'orientation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Titre</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Orientation chômage"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") create();
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Segment</label>
              <Input
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                placeholder="chomage"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button onClick={create} disabled={creating || !title.trim()}>
              {creating && <Loader2 className="size-4 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
