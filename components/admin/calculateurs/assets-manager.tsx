"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/* ------------------------------------------------------------------ */
/*  Types & constantes                                                */
/* ------------------------------------------------------------------ */

export interface CalculatorAsset {
  id: string;
  slug: string;
  kind: "pdf" | "url" | "image" | string;
  label: string;
  description: string | null;
  url: string;
  category: string | null;
  fileSize: number | null;
  mimeType: string | null;
  year: number | null;
  order: number;
  uploadedAt: string;
  uploadedBy: string | null;
}

const CATEGORIES = [
  { value: "general", label: "Général" },
  { value: "workbonus", label: "Workbonus" },
  { value: "precompte", label: "Précompte" },
  { value: "css", label: "Cotisation spéciale (CSS)" },
  { value: "atn", label: "ATN" },
  { value: "tarif-social", label: "Tarif social" },
  { value: "frais-km", label: "Frais kilométriques" },
  { value: "ipp", label: "IPP" },
  { value: "chomage", label: "Chômage" },
  { value: "pension", label: "Pension" },
  { value: "alloc-fam", label: "Allocations familiales" },
] as const;

const KIND_LABELS: Record<string, string> = {
  pdf: "PDF",
  url: "URL",
  image: "Image",
};

const CURRENT_YEAR = new Date().getFullYear();

function fmtSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-BE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function kindIcon(kind: string) {
  if (kind === "url") return Link2;
  if (kind === "image") return ImageIcon;
  return FileText;
}

/* ------------------------------------------------------------------ */
/*  Composant principal                                               */
/* ------------------------------------------------------------------ */

interface AssetsManagerProps {
  slug: string;
  /** Assets initiaux (chargés côté serveur). Le composant les re-fetch ensuite si besoin. */
  initialAssets: CalculatorAsset[];
}

export function AssetsManager({ slug, initialAssets }: AssetsManagerProps) {
  const [assets, setAssets] = useState<CalculatorAsset[]>(initialAssets);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CalculatorAsset | null>(null);

  // Re-fetch après mutation
  async function reload() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/calculators/${slug}/assets`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setAssets(json.assets ?? []);
    } catch (e) {
      toast.error("Impossible de recharger les sources", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(asset: CalculatorAsset) {
    if (
      !confirm(
        `Supprimer la source « ${asset.label} » ?\nCette action est définitive.`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch(
        `/api/admin/calculators/${slug}/assets/${asset.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      toast.success("Source supprimée");
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
    } catch (e) {
      toast.error("Échec de la suppression", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Tri stable par order puis date
  const sorted = useMemo(
    () =>
      [...assets].sort(
        (a, b) =>
          a.order - b.order ||
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
      ),
    [assets],
  );

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-bold leading-tight">
            Sources officielles &amp; PDFs
          </h2>
          <p className="text-[12.5px] text-muted-foreground">
            URLs externes (SPF, Securex, CSC…) et fichiers PDF / images
            téléchargeables attachés à ce calculateur.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          size="sm"
          className="gap-1.5"
        >
          <Plus className="size-3.5" />
          Ajouter une source
        </Button>
      </header>

      {/* Liste --------------------------------------------------------- */}
      <div className="mt-4">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-[12.5px] text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Chargement…
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-8 text-center text-[12.5px] text-muted-foreground">
            Aucune source attachée pour l&apos;instant. Utilise le bouton
            ci-dessus pour ajouter un PDF officiel ou une URL de référence.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {sorted.map((a) => {
              const Icon = kindIcon(a.kind);
              return (
                <li
                  key={a.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-background/40 p-3"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="mt-0.5 flex size-9 items-center justify-center rounded-lg bg-muted">
                      <Icon className="size-4 text-muted-foreground" />
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-[13px] font-semibold text-foreground hover:underline"
                        >
                          {a.label}
                        </a>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
                          {KIND_LABELS[a.kind] ?? a.kind}
                        </span>
                        {a.category ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] font-semibold text-primary">
                            {CATEGORIES.find((c) => c.value === a.category)?.label ?? a.category}
                          </span>
                        ) : null}
                        {a.year ? (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
                            {a.year}
                          </span>
                        ) : null}
                      </div>
                      {a.description ? (
                        <p className="text-[12px] leading-relaxed text-muted-foreground line-clamp-2">
                          {a.description}
                        </p>
                      ) : null}
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span>Ajouté le {fmtDate(a.uploadedAt)}</span>
                        {a.fileSize ? <span>· {fmtSize(a.fileSize)}</span> : null}
                        {a.mimeType ? <span>· {a.mimeType}</span> : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      title={a.kind === "url" ? "Ouvrir le lien" : "Télécharger"}
                    >
                      {a.kind === "url" ? (
                        <ExternalLink className="size-3.5" />
                      ) : (
                        <Download className="size-3.5" />
                      )}
                    </a>
                    <button
                      type="button"
                      onClick={() => setEditing(a)}
                      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Modifier"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(a)}
                      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/20 dark:hover:text-red-300"
                      title="Supprimer"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Dialogs ------------------------------------------------------- */}
      {createOpen ? (
        <CreateAssetDialog
          slug={slug}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={async () => {
            setCreateOpen(false);
            await reload();
          }}
        />
      ) : null}
      {editing ? (
        <EditAssetDialog
          slug={slug}
          asset={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
        />
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Dialog : créer une source                                         */
/* ------------------------------------------------------------------ */

interface CreateProps {
  slug: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}

function CreateAssetDialog({ slug, open, onOpenChange, onCreated }: CreateProps) {
  const [kind, setKind] = useState<"url" | "pdf" | "image">("url");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [year, setYear] = useState<string>(String(CURRENT_YEAR));
  const [externalUrl, setExternalUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      // reset form when re-opened
      setKind("url");
      setLabel("");
      setDescription("");
      setCategory("general");
      setYear(String(CURRENT_YEAR));
      setExternalUrl("");
      setFile(null);
      setSubmitting(false);
    }
  }, [open]);

  async function handleSubmit() {
    if (label.trim().length < 2) {
      toast.error("Donne un libellé (min. 2 caractères)");
      return;
    }
    setSubmitting(true);
    try {
      if (kind === "url") {
        if (!/^https?:\/\//i.test(externalUrl.trim())) {
          toast.error("URL invalide (doit commencer par http:// ou https://)");
          setSubmitting(false);
          return;
        }
        const res = await fetch(`/api/admin/calculators/${slug}/assets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "url",
            label: label.trim(),
            description: description.trim() || null,
            url: externalUrl.trim(),
            category: category || null,
            year: year ? Number.parseInt(year, 10) : null,
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `HTTP ${res.status}`);
        }
      } else {
        if (!file) {
          toast.error("Sélectionne un fichier à uploader");
          setSubmitting(false);
          return;
        }
        const fd = new FormData();
        fd.append("file", file);
        fd.append("kind", kind);
        fd.append("label", label.trim());
        if (description.trim()) fd.append("description", description.trim());
        if (category) fd.append("category", category);
        if (year) fd.append("year", year);
        const res = await fetch(`/api/admin/calculators/${slug}/assets`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `HTTP ${res.status}`);
        }
      }
      toast.success("Source ajoutée");
      onCreated();
    } catch (e) {
      toast.error("Échec de l'ajout", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter une source</DialogTitle>
          <DialogDescription>
            URL officielle, PDF téléchargeable ou image. Limité à 10 MB par
            fichier.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          {/* Type --------------------------------------------------- */}
          <div>
            <Label className="text-[12.5px]">Type</Label>
            <div className="mt-1 flex gap-1.5">
              {(["url", "pdf", "image"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`flex-1 rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold ${
                    kind === k
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {k === "url" ? "URL externe" : k === "pdf" ? "Upload PDF" : "Upload image"}
                </button>
              ))}
            </div>
          </div>

          {/* Label -------------------------------------------------- */}
          <div>
            <Label htmlFor="asset-label" className="text-[12.5px]">
              Libellé *
            </Label>
            <Input
              id="asset-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex. Barème SPF précompte 2026"
              className="mt-1"
            />
          </div>

          {/* Description ------------------------------------------- */}
          <div>
            <Label htmlFor="asset-desc" className="text-[12.5px]">
              Description
            </Label>
            <Textarea
              id="asset-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optionnel — contexte, version, particularités…"
              className="mt-1"
            />
          </div>

          {/* URL / fichier ------------------------------------------ */}
          {kind === "url" ? (
            <div>
              <Label htmlFor="asset-url" className="text-[12.5px]">
                URL *
              </Label>
              <Input
                id="asset-url"
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://finances.belgium.be/..."
                className="mt-1"
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="asset-file" className="text-[12.5px]">
                Fichier * <span className="text-muted-foreground">(max 10 MB)</span>
              </Label>
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-dashed border-border p-3">
                <Upload className="size-4 text-muted-foreground" />
                <input
                  id="asset-file"
                  type="file"
                  accept={kind === "pdf" ? "application/pdf" : "image/png,image/jpeg,image/webp"}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="flex-1 text-[12.5px]"
                />
              </div>
              {file ? (
                <p className="mt-1 text-[11.5px] text-muted-foreground">
                  {file.name} · {fmtSize(file.size)}
                </p>
              ) : null}
            </div>
          )}

          {/* Catégorie + année (2 cols) ----------------------------- */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="asset-cat" className="text-[12.5px]">
                Catégorie
              </Label>
              <select
                id="asset-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-[13px] dark:bg-input/30"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="asset-year" className="text-[12.5px]">
                Année
              </Label>
              <Input
                id="asset-year"
                type="number"
                min={1990}
                max={2100}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2026"
                className="mt-1"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 size-3.5 animate-spin" />
                Envoi…
              </>
            ) : (
              "Ajouter"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Dialog : éditer une source                                        */
/* ------------------------------------------------------------------ */

interface EditProps {
  slug: string;
  asset: CalculatorAsset;
  onClose: () => void;
  onSaved: () => void;
}

function EditAssetDialog({ slug, asset, onClose, onSaved }: EditProps) {
  const [label, setLabel] = useState(asset.label);
  const [description, setDescription] = useState(asset.description ?? "");
  const [category, setCategory] = useState(asset.category ?? "general");
  const [year, setYear] = useState(asset.year ? String(asset.year) : "");
  const [order, setOrder] = useState(String(asset.order));
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    if (label.trim().length < 2) {
      toast.error("Libellé requis (min. 2 caractères)");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/admin/calculators/${slug}/assets/${asset.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: label.trim(),
            description: description.trim() || null,
            category: category || null,
            year: year ? Number.parseInt(year, 10) : null,
            order: order ? Number.parseInt(order, 10) : 0,
          }),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      toast.success("Source mise à jour");
      onSaved();
    } catch (e) {
      toast.error("Échec de la mise à jour", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier la source</DialogTitle>
          <DialogDescription>
            Le type ({KIND_LABELS[asset.kind] ?? asset.kind}) et l&apos;URL ne
            sont pas modifiables — supprime et recrée si besoin.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          <div>
            <Label htmlFor="edit-label" className="text-[12.5px]">
              Libellé *
            </Label>
            <Input
              id="edit-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="edit-desc" className="text-[12.5px]">
              Description
            </Label>
            <Textarea
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="edit-cat" className="text-[12.5px]">
                Catégorie
              </Label>
              <select
                id="edit-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-[13px] dark:bg-input/30"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="edit-year" className="text-[12.5px]">
                Année
              </Label>
              <Input
                id="edit-year"
                type="number"
                min={1990}
                max={2100}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="edit-order" className="text-[12.5px]">
                Ordre
              </Label>
              <Input
                id="edit-order"
                type="number"
                min={0}
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 size-3.5 animate-spin" />
                Enregistrement…
              </>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
