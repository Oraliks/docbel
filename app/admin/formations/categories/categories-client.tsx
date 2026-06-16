"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tags, Plus, Loader2, Check, X, Pencil, Award } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  AdminCategoryRow,
  AdminTagRow,
  AdminBadgeRow,
} from "@/lib/formations/admin-queries";

interface Props {
  categories: AdminCategoryRow[];
  tags: AdminTagRow[];
  badges: AdminBadgeRow[];
}

export function CategoriesClient({ categories, tags, badges }: Props) {
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Tags className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Taxonomie des formations
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Catégories, tags et badges du catalogue.
          </p>
        </div>
      </div>

      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">
            Catégories ({categories.length})
          </TabsTrigger>
          <TabsTrigger value="tags">Tags ({tags.length})</TabsTrigger>
          <TabsTrigger value="badges">Badges ({badges.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-4">
          <CategoriesTab rows={categories} />
        </TabsContent>
        <TabsContent value="tags" className="mt-4">
          <TagsTab rows={tags} />
        </TabsContent>
        <TabsContent value="badges" className="mt-4">
          <BadgesTab rows={badges} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------- Catégories

function CategoriesTab({ rows }: { rows: AdminCategoryRow[] }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/formations/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Échec de la création");
      toast.success("Catégorie créée.");
      setNewName("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (row: AdminCategoryRow, isActive: boolean) => {
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/formations/categories/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Échec");
      router.refresh();
    } catch {
      toast.error("Impossible de modifier la catégorie.");
    } finally {
      setBusyId(null);
    }
  };

  const rename = async (row: AdminCategoryRow, name: string) => {
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/formations/categories/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Échec");
      toast.success("Catégorie renommée.");
      router.refresh();
    } catch {
      toast.error("Impossible de renommer la catégorie.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <CreateBar
        value={newName}
        onChange={setNewName}
        onSubmit={create}
        loading={creating}
        placeholder="Nom de la catégorie…"
      />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Catégorie</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead className="text-right">Formations</TableHead>
              <TableHead className="w-24 text-center">Active</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Aucune catégorie.
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <EditableRow
                key={row.id}
                name={row.name}
                slug={row.slug}
                count={row.trainingsCount}
                isActive={row.isActive}
                busy={busyId === row.id}
                color={row.color}
                onToggleActive={(v) => toggleActive(row, v)}
                onRename={(name) => rename(row, name)}
              />
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// --------------------------------------------------------------------- Tags

function TagsTab({ rows }: { rows: AdminTagRow[] }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/formations/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Échec de la création");
      toast.success("Tag créé.");
      setNewName("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setCreating(false);
    }
  };

  const toggleOrientation = async (row: AdminTagRow, isOrientationTag: boolean) => {
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/formations/tags/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOrientationTag }),
      });
      if (!res.ok) throw new Error("Échec");
      router.refresh();
    } catch {
      toast.error("Impossible de modifier le tag.");
    } finally {
      setBusyId(null);
    }
  };

  const rename = async (row: AdminTagRow, name: string) => {
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/formations/tags/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Échec");
      toast.success("Tag renommé.");
      router.refresh();
    } catch {
      toast.error("Impossible de renommer le tag.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <CreateBar
        value={newName}
        onChange={setNewName}
        onSubmit={create}
        loading={creating}
        placeholder="Nom du tag…"
      />
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tag</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead className="text-right">Formations</TableHead>
              <TableHead className="w-32 text-center">Orientation</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Aucun tag.
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <EditableRow
                key={row.id}
                name={row.name}
                slug={row.slug}
                count={row.trainingsCount}
                isActive={row.isOrientationTag}
                busy={busyId === row.id}
                onToggleActive={(v) => toggleOrientation(row, v)}
                onRename={(name) => rename(row, name)}
              />
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------- Badges

function BadgesTab({ rows }: { rows: AdminBadgeRow[] }) {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Badge</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Contrôle</TableHead>
            <TableHead className="text-right">Formations</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                Aucun badge. Les badges officiels sont définis au seed.
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <span className="flex items-center gap-2 font-medium">
                  <Award
                    className="size-4"
                    style={row.color ? { color: row.color } : undefined}
                  />
                  {row.name}
                </span>
                {row.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {row.description}
                  </p>
                )}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {row.slug}
              </TableCell>
              <TableCell>
                {row.controlledByAdmin ? (
                  <Badge variant="info" className="text-[10px]">
                    Admin uniquement
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">
                    Libre
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.trainingsCount}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// ------------------------------------------------------------ Sous-composants

function CreateBar({
  value,
  onChange,
  onSubmit,
  loading,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  placeholder: string;
}) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
          }}
        />
        <Button size="sm" onClick={onSubmit} disabled={loading || !value.trim()}>
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Créer
        </Button>
      </CardContent>
    </Card>
  );
}

function EditableRow({
  name,
  slug,
  count,
  isActive,
  busy,
  color,
  onToggleActive,
  onRename,
}: {
  name: string;
  slug: string;
  count: number;
  isActive: boolean;
  busy: boolean;
  color?: string;
  onToggleActive: (v: boolean) => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  return (
    <TableRow className={busy ? "opacity-60" : ""}>
      <TableCell>
        {editing ? (
          <div className="flex items-center gap-1.5">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-7 max-w-[220px]"
              autoFocus
            />
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => {
                if (draft.trim() && draft.trim() !== name) onRename(draft.trim());
                setEditing(false);
              }}
            >
              <Check className="size-4 text-emerald-600" />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => {
                setDraft(name);
                setEditing(false);
              }}
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <span className="flex items-center gap-2 font-medium">
            {color && (
              <span
                className="inline-block size-3 rounded-full"
                style={{ backgroundColor: color }}
              />
            )}
            {name}
          </span>
        )}
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {slug}
      </TableCell>
      <TableCell className="text-right tabular-nums">{count}</TableCell>
      <TableCell className="text-center">
        <Switch
          checked={isActive}
          onCheckedChange={onToggleActive}
          disabled={busy}
        />
      </TableCell>
      <TableCell className="text-right">
        {!editing && (
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => {
              setDraft(name);
              setEditing(true);
            }}
          >
            <Pencil className="size-4" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
