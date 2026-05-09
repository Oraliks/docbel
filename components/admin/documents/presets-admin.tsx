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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const BELGIAN_TYPES = [
  { value: "", label: "—" },
  { value: "niss", label: "NISS" },
  { value: "iban", label: "IBAN" },
  { value: "bce", label: "BCE" },
  { value: "tva", label: "TVA" },
  { value: "postal", label: "Code postal" },
  { value: "phone", label: "Téléphone" },
];

const CROSS_FIELD_TYPES = [
  { value: "", label: "—" },
  { value: "equals", label: "égal à" },
  { value: "notEquals", label: "différent de" },
  { value: "after", label: "après (date)" },
  { value: "before", label: "avant (date)" },
  { value: "greaterThan", label: "> (nombre)" },
  { value: "lessThan", label: "< (nombre)" },
];

interface FormState {
  name: string;
  description: string;
  category: string;
  fieldType: string;
  regex: string;
  regexFlags: string;
  minLength: string;
  maxLength: string;
  minValue: string;
  maxValue: string;
  minDate: string;
  maxDate: string;
  belgianType: string;
  crossFieldRuleType: string;
  crossFieldRuleFieldId: string;
  errorMsg: string;
  errorMsgNl: string;
  helpText: string;
  helpTextNl: string;
  placeholder: string;
  placeholderNl: string;
  icon: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  category: "custom",
  fieldType: "text",
  regex: "",
  regexFlags: "",
  minLength: "",
  maxLength: "",
  minValue: "",
  maxValue: "",
  minDate: "",
  maxDate: "",
  belgianType: "",
  crossFieldRuleType: "",
  crossFieldRuleFieldId: "",
  errorMsg: "",
  errorMsgNl: "",
  helpText: "",
  helpTextNl: "",
  placeholder: "",
  placeholderNl: "",
  icon: "",
};

function presetToForm(p: Preset): FormState {
  return {
    name: p.name,
    description: p.description ?? "",
    category: p.category,
    fieldType: p.fieldType,
    regex: p.regex ?? "",
    regexFlags: p.regexFlags ?? "",
    minLength: p.minLength?.toString() ?? "",
    maxLength: p.maxLength?.toString() ?? "",
    minValue: p.minValue?.toString() ?? "",
    maxValue: p.maxValue?.toString() ?? "",
    minDate: p.minDate ?? "",
    maxDate: p.maxDate ?? "",
    belgianType: p.belgianType ?? "",
    crossFieldRuleType: p.crossFieldRule?.type ?? "",
    crossFieldRuleFieldId: p.crossFieldRule?.fieldId ?? "",
    errorMsg: p.errorMsg,
    errorMsgNl: p.errorMsgNl ?? "",
    helpText: p.helpText ?? "",
    helpTextNl: p.helpTextNl ?? "",
    placeholder: p.placeholder ?? "",
    placeholderNl: p.placeholderNl ?? "",
    icon: p.icon ?? "",
  };
}

function formToPayload(form: FormState): Record<string, unknown> {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    category: form.category,
    fieldType: form.fieldType,
    regex: form.regex.trim() || null,
    regexFlags: form.regexFlags.trim() || null,
    minLength: form.minLength ? parseInt(form.minLength, 10) : null,
    maxLength: form.maxLength ? parseInt(form.maxLength, 10) : null,
    minValue: form.minValue ? parseFloat(form.minValue) : null,
    maxValue: form.maxValue ? parseFloat(form.maxValue) : null,
    minDate: form.minDate.trim() || null,
    maxDate: form.maxDate.trim() || null,
    belgianType: form.belgianType || null,
    crossFieldRule: form.crossFieldRuleType
      ? { type: form.crossFieldRuleType, fieldId: form.crossFieldRuleFieldId.trim() }
      : null,
    errorMsg: form.errorMsg.trim(),
    errorMsgNl: form.errorMsgNl.trim() || null,
    helpText: form.helpText.trim() || null,
    helpTextNl: form.helpTextNl.trim() || null,
    placeholder: form.placeholder.trim() || null,
    placeholderNl: form.placeholderNl.trim() || null,
    icon: form.icon.trim() || null,
  };
}

export function PresetsAdmin({ initial }: { initial: Preset[] }) {
  const router = useRouter();
  const [presets, setPresets] = useState(initial);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [fieldTypeFilter, setFieldTypeFilter] = useState("all");

  const [editing, setEditing] = useState<Preset | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Preset | null>(null);

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

  function openCreate() {
    setForm(EMPTY_FORM);
    setCreating(true);
  }

  function openEdit(p: Preset) {
    setForm(presetToForm(p));
    setEditing(p);
  }

  function openDuplicate(p: Preset) {
    const copy = presetToForm(p);
    copy.name = `${p.name} (copie)`;
    setForm(copy);
    setCreating(true);
  }

  function closeDialog() {
    setEditing(null);
    setCreating(false);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      const payload = formToPayload(form);
      if (!payload.name) throw new Error("Nom requis");
      if (!payload.errorMsg) throw new Error("Message d'erreur requis");

      const isUpdate = !!editing;
      const url = isUpdate ? `/api/documents/presets/${editing!.id}` : `/api/documents/presets`;
      const method = isUpdate ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Échec");
      }
      const saved = await res.json();
      if (isUpdate) {
        setPresets((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      } else {
        setPresets((prev) => [...prev, saved]);
      }
      toast.success(isUpdate ? "Preset mis à jour" : "Preset créé");
      closeDialog();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
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
            {filtered.length} sur {presets.length} preset{presets.length !== 1 ? "s" : ""} · Réutilisables
            sur tous les documents.
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
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
              if (p.minLength != null || p.maxLength != null) rules.push(`len ${p.minLength ?? "?"}-${p.maxLength ?? "?"}`);
              if (p.minValue != null || p.maxValue != null) rules.push(`val ${p.minValue ?? "?"}-${p.maxValue ?? "?"}`);
              if (p.minDate || p.maxDate) rules.push("date");
              if (p.crossFieldRule) rules.push(`cf:${p.crossFieldRule.type}`);
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{p.name}</span>
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
                    </div>
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
                      <Button variant="ghost" size="sm" onClick={() => openDuplicate(p)} title="Dupliquer">
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
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

      {/* Dialog create/edit */}
      <Dialog open={creating || !!editing} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Modifier "${editing.name}"` : "Nouveau preset"}
              {editing?.builtin && (
                <Badge variant="outline" className="ml-2 text-xs">
                  Builtin
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Les presets s&apos;appliquent à des champs lors de l&apos;édition d&apos;un document.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nom *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nom de famille"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Catégorie</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => v && setForm({ ...form, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                placeholder="Lettres, espaces, tirets et apostrophes uniquement."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Type de champ *</Label>
                <Select
                  value={form.fieldType}
                  onValueChange={(v) => v && setForm({ ...form, fieldType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Validateur natif belge</Label>
                <Select
                  value={form.belgianType || "__none__"}
                  onValueChange={(v) => setForm({ ...form, belgianType: v === "__none__" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BELGIAN_TYPES.map((t) => (
                      <SelectItem key={t.value || "__none__"} value={t.value || "__none__"}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border rounded p-3 bg-muted/30 space-y-3">
              <p className="text-xs font-medium">Règles de validation (toutes optionnelles)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Regex</Label>
                  <Input
                    value={form.regex}
                    onChange={(e) => setForm({ ...form, regex: e.target.value })}
                    placeholder="^[A-Za-z]+$"
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Flags regex</Label>
                  <Input
                    value={form.regexFlags}
                    onChange={(e) => setForm({ ...form, regexFlags: e.target.value })}
                    placeholder="i"
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Longueur min</Label>
                  <Input
                    type="number"
                    value={form.minLength}
                    onChange={(e) => setForm({ ...form, minLength: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Longueur max</Label>
                  <Input
                    type="number"
                    value={form.maxLength}
                    onChange={(e) => setForm({ ...form, maxLength: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Valeur min (number)</Label>
                  <Input
                    type="number"
                    step="any"
                    value={form.minValue}
                    onChange={(e) => setForm({ ...form, minValue: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Valeur max (number)</Label>
                  <Input
                    type="number"
                    step="any"
                    value={form.maxValue}
                    onChange={(e) => setForm({ ...form, maxValue: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Date min</Label>
                  <Input
                    value={form.minDate}
                    onChange={(e) => setForm({ ...form, minDate: e.target.value })}
                    placeholder="today, 1900-01-01, @field_id"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Date max</Label>
                  <Input
                    value={form.maxDate}
                    onChange={(e) => setForm({ ...form, maxDate: e.target.value })}
                    placeholder="today, @field_id"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                <div className="space-y-1.5">
                  <Label className="text-xs">Règle cross-field</Label>
                  <Select
                    value={form.crossFieldRuleType || "__none__"}
                    onValueChange={(v) =>
                      setForm({ ...form, crossFieldRuleType: v === "__none__" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CROSS_FIELD_TYPES.map((t) => (
                        <SelectItem key={t.value || "__none__"} value={t.value || "__none__"}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">ID du champ référence</Label>
                  <Input
                    value={form.crossFieldRuleFieldId}
                    onChange={(e) => setForm({ ...form, crossFieldRuleFieldId: e.target.value })}
                    placeholder="date_debut"
                    disabled={!form.crossFieldRuleType}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Message d&apos;erreur *</Label>
              <Input
                value={form.errorMsg}
                onChange={(e) => setForm({ ...form, errorMsg: e.target.value })}
                placeholder="Nom invalide. Lettres, espaces, tirets uniquement."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Message d&apos;erreur (NL)</Label>
              <Input
                value={form.errorMsgNl}
                onChange={(e) => setForm({ ...form, errorMsgNl: e.target.value })}
                placeholder="Ongeldig…"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Texte d&apos;aide</Label>
                <Input
                  value={form.helpText}
                  onChange={(e) => setForm({ ...form, helpText: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Aide (NL)</Label>
                <Input
                  value={form.helpTextNl}
                  onChange={(e) => setForm({ ...form, helpTextNl: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Placeholder</Label>
                <Input
                  value={form.placeholder}
                  onChange={(e) => setForm({ ...form, placeholder: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Placeholder (NL)</Label>
                <Input
                  value={form.placeholderNl}
                  onChange={(e) => setForm({ ...form, placeholderNl: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || !form.name || !form.errorMsg}
            >
              {saving ? "Enregistrement…" : editing ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce preset ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget.usageCount > 0 ? (
                <>
                  Ce preset est utilisé par <b>{deleteTarget.usageCount} champ(s)</b>. Sa suppression
                  laissera ces champs sans preset (ils garderont leur propre validation).
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
