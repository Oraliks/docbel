"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Library,
  Search,
  X,
  Lock,
  Copy,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Preset {
  id: string;
  name: string;
  description: string | null;
  category: string;
  fieldType: string;
  regex: string | null;
  regexFlags: string | null;
  minLength: number | null;
  maxLength: number | null;
  minValue: number | null;
  maxValue: number | null;
  minDate: string | null;
  maxDate: string | null;
  belgianType: string | null;
  crossFieldRule: { type: string; fieldId: string } | null;
  errorMsg: string;
  errorMsgNl: string | null;
  helpText: string | null;
  helpTextNl: string | null;
  placeholder: string | null;
  placeholderNl: string | null;
  builtin: boolean;
  icon: string | null;
  color: string | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  { value: "identity", label: "Identité" },
  { value: "contact", label: "Contact" },
  { value: "address", label: "Adresse" },
  { value: "financial", label: "Financier" },
  { value: "date", label: "Date" },
  { value: "belgian", label: "Belge (validateurs natifs)" },
  { value: "custom", label: "Personnalisé" },
];

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

const FIELD_TYPES = [
  { value: "text", label: "Texte" },
  { value: "textarea", label: "Texte multiligne" },
  { value: "number", label: "Nombre" },
  { value: "date", label: "Date" },
  { value: "select", label: "Liste déroulante" },
  { value: "checkbox", label: "Case à cocher" },
  { value: "niss", label: "NISS belge" },
  { value: "iban", label: "IBAN belge" },
  { value: "bce", label: "BCE / N° entreprise" },
  { value: "tva_be", label: "TVA belge" },
  { value: "postal_be", label: "Code postal belge" },
  { value: "phone_be", label: "Téléphone belge" },
];

export function PresetsAdmin({ initial }: { initial: Preset[] }) {
  const router = useRouter();
  const [presets, setPresets] = useState(initial);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [fieldTypeFilter, setFieldTypeFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<Preset | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return presets.filter((p) => {
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (fieldTypeFilter !== "all" && p.fieldType !== fieldTypeFilter) return false;
      if (q) {
        const hay = `${p.name} ${p.description ?? ""} ${p.errorMsg}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [presets, search, categoryFilter, fieldTypeFilter]);

  async function duplicate(p: Preset) {
    setDuplicating(p.id);
    try {
      const payload = {
        name: `${p.name} (copie)`,
        description: p.description,
        category: p.category,
        fieldType: p.fieldType,
        regex: p.regex,
        regexFlags: p.regexFlags,
        minLength: p.minLength,
        maxLength: p.maxLength,
        minValue: p.minValue,
        maxValue: p.maxValue,
        minDate: p.minDate,
        maxDate: p.maxDate,
        belgianType: p.belgianType,
        crossFieldRule: p.crossFieldRule,
        errorMsg: p.errorMsg,
        errorMsgNl: p.errorMsgNl,
        helpText: p.helpText,
        helpTextNl: p.helpTextNl,
        placeholder: p.placeholder,
        placeholderNl: p.placeholderNl,
      };
      const res = await fetch("/api/documents/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Échec");
      }
      const created = await res.json();
      toast.success("Preset dupliqué");
      router.push(`/admin/documents/presets/${created.id}/edit`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setDuplicating(null);
    }
  }

  async function handleDelete(p: Preset) {
    try {
      const res = await fetch(`/api/documents/presets/${p.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Échec");
      }
      setPresets((prev) => prev.filter((x) => x.id !== p.id));
      toast.success("Supprimé");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button render={<Link href="/admin/documents" />} variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Library className="w-7 h-7" />
            Presets de validation
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} sur {presets.length} preset{presets.length !== 1 ? "s" : ""} ·
            Réutilisables sur tous les documents.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              const res = await fetch("/api/documents/presets/recount", { method: "POST" });
              if (!res.ok) throw new Error("Échec");
              const data = await res.json();
              toast.success(
                `Recompté : ${data.presetsUpdated} preset(s) sur ${data.templatesScanned} template(s).`
              );
              router.refresh();
            } catch {
              toast.error("Erreur");
            }
          }}
          title="Recompte les utilisations en parcourant tous les schemas"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Recompter
        </Button>
        <Button render={<Link href="/admin/documents/presets/new" />} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Nouveau preset
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, description, message…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-8"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v || "all")}>
          <SelectTrigger className="w-auto min-w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fieldTypeFilter} onValueChange={(v) => setFieldTypeFilter(v || "all")}>
          <SelectTrigger className="w-auto min-w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            {FIELD_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Nom</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Règles</TableHead>
              <TableHead>Usages</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => {
              const rules: string[] = [];
              if (p.belgianType) rules.push(`belge:${p.belgianType}`);
              if (p.regex) rules.push("regex");
              if (p.minLength != null || p.maxLength != null)
                rules.push(`len ${p.minLength ?? "?"}-${p.maxLength ?? "?"}`);
              if (p.minValue != null || p.maxValue != null)
                rules.push(`val ${p.minValue ?? "?"}-${p.maxValue ?? "?"}`);
              if (p.minDate || p.maxDate) rules.push("date");
              if (p.crossFieldRule) rules.push(`cf:${p.crossFieldRule.type}`);
              return (
                <TableRow key={p.id} className="hover:bg-muted/40">
                  <TableCell>
                    <Link
                      href={`/admin/documents/presets/${p.id}/edit`}
                      className="block min-w-0"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium hover:underline">{p.name}</span>
                        {p.builtin && (
                          <Lock
                            className="w-3 h-3 text-muted-foreground"
                            aria-label="Preset système"
                          />
                        )}
                      </div>
                      {p.description && (
                        <div className="text-xs text-muted-foreground truncate max-w-md">
                          {p.description}
                        </div>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {CATEGORY_LABEL[p.category] || p.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{p.fieldType}</code>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {rules.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        rules.map((r) => (
                          <Badge key={r} variant="secondary" className="text-[10px] font-mono">
                            {r}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{p.usageCount}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => duplicate(p)}
                        disabled={duplicating === p.id}
                        title="Dupliquer"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        render={<Link href={`/admin/documents/presets/${p.id}/edit`} />}
                        variant="ghost"
                        size="sm"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      {!p.builtin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(p)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  Aucun preset.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce preset ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget.usageCount > 0 ? (
                <>
                  Ce preset est utilisé par <b>{deleteTarget.usageCount} champ(s)</b>. Sa
                  suppression laissera ces champs sans preset (ils garderont leur propre validation).
                </>
              ) : (
                <>Cette action supprimera définitivement &quot;{deleteTarget?.name}&quot;.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
