"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronRight, CircleDot, GitBranch, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { TableSkeleton } from "@/components/ui/skeletons";
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
  hasUnpublishedChanges: boolean;
  _count: { revisions: number };
}

export function DecisionTreesList() {
  const router = useRouter();
  const t = useTranslations("admin.decisionTrees.list");
  const [trees, setTrees] = useState<TreeRow[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [segment, setSegment] = useState("chomage");
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    fetch("/api/decision-trees")
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => setTrees(Array.isArray(data) ? data : []))
      .catch(() => setTrees([]));
  }, []);

  useEffect(() => load(), [load]);

  async function create() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const response = await fetch("/api/decision-trees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), segment: segment.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.error || t("createError"));
        return;
      }
      toast.success(t("createSuccess"));
      router.push(`/admin/decision-trees/${data.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <GitBranch className="size-5" />
          </span>
          <div>
            <p className="text-sm font-medium">
              {trees === null ? t("loading") : t("treeCount", { count: trees.length })}
            </p>
            <p className="text-xs text-muted-foreground">{t("summary")}</p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> {t("newTree")}
        </Button>
      </div>

      {trees === null ? (
        <TableSkeleton rows={3} columns={4} withAvatar />
      ) : trees.length === 0 ? (
        <Empty className="min-h-72 border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><GitBranch /></EmptyMedia>
            <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> {t("newTree")}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>{t("columns.tree")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("columns.segment")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
                <TableHead className="hidden text-right sm:table-cell">{t("columns.versions")}</TableHead>
                <TableHead className="w-12"><span className="sr-only">{t("open")}</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trees.map((tree) => (
                <TableRow key={tree.id} className="group">
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => router.push(`/admin/decision-trees/${tree.id}`)}
                      className="flex min-h-11 w-full items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition group-hover:bg-primary/10 group-hover:text-primary">
                        <GitBranch className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{tree.title}</span>
                        <span className="block truncate font-mono text-xs text-muted-foreground">{tree.slug}</span>
                      </span>
                    </button>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline">{tree.segment}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={tree.status === "published" ? "default" : tree.status === "draft" ? "secondary" : "outline"}>
                        {t(`status.${tree.status}`)}
                      </Badge>
                      {tree.hasUnpublishedChanges && (
                        <Badge variant="secondary" className="gap-1 border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300">
                          <CircleDot className="size-3" />
                          <span className="hidden lg:inline">{t("unpublished")}</span>
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">
                    {tree._count.revisions}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => router.push(`/admin/decision-trees/${tree.id}`)}
                      aria-label={t("openTree", { title: tree.title })}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialog.title")}</DialogTitle>
            <DialogDescription>{t("dialog.description")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <label className="grid gap-1.5 text-sm font-medium">
              {t("dialog.name")}
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("dialog.namePlaceholder")}
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === "Enter") void create();
                }}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              {t("dialog.segment")}
              <Input
                value={segment}
                onChange={(event) => setSegment(event.target.value)}
                placeholder="chomage"
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("dialog.cancel")}
            </Button>
            <Button onClick={() => void create()} disabled={creating || !title.trim()}>
              {creating && <Loader2 className="size-4 animate-spin" />}
              {t("dialog.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
