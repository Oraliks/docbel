"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Library,
  Trash2,
  Lock,
  Lightbulb,
  TestTube2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const CATEGORIES = [
  { value: "identity", label: "Identité" },
  { value: "contact", label: "Contact" },
  { value: "address", label: "Adresse" },
  { value: "financial", label: "Financier" },
  { value: "date", label: "Date" },
  { value: "belgian", label: "Belge (validateurs natifs)" },
  { value: "custom", label: "Personnalisé" },
];

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

export interface PresetFormState {
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

export const EMPTY_PRESET_FORM: PresetFormState = {
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

interface PresetFormProps {
  presetId?: string; // si défini = édition, sinon création
  initial?: PresetFormState;
  builtin?: boolean;
  usageCount?: number;
}

export function PresetForm({ presetId, initial, builtin = false, usageCount = 0 }: PresetFormProps) {
  const router = useRouter();
  const isEdit = !!presetId;
  const [form, setForm] = useState<PresetFormState>(initial || EMPTY_PRESET_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [testValue, setTestValue] = useState("");
  const [testResult, setTestResult] = useState<"valid" | "invalid" | null>(null);

  function update<K extends keyof PresetFormState>(key: K, value: PresetFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function buildPayload() {
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

  async function save() {
    if (!form.name.trim()) return toast.error("Nom requis");
    if (!form.errorMsg.trim()) return toast.error("Message d'erreur requis");

    setSaving(true);
    try {
      const url = isEdit ? `/api/documents/presets/${presetId}` : `/api/documents/presets`;
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Échec");
      }
      const saved = await res.json();
      toast.success(isEdit ? "Preset mis à jour" : "Preset créé");
      if (!isEdit) {
        router.push(`/admin/documents/presets/${saved.id}/edit`);
      } else {
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!presetId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/presets/${presetId}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Échec");
      }
      toast.success("Preset supprimé");
      router.push("/admin/documents/config?tab=presets");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
      setDeleting(false);
    }
  }

  function testRegex() {
    if (!form.regex) {
      setTestResult(null);
      return;
    }
    try {
      const re = new RegExp(form.regex, form.regexFlags || undefined);
      setTestResult(re.test(testValue) ? "valid" : "invalid");
    } catch {
      setTestResult("invalid");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button render={<Link href="/admin/documents/config?tab=presets" />} variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour à la liste
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold flex items-center gap-2 truncate">
            <Library className="w-6 h-6 flex-shrink-0" />
            {isEdit ? `Modifier "${initial?.name || ""}"` : "Nouveau preset"}
            {builtin && (
              <Badge variant="outline" className="text-xs gap-1">
                <Lock className="w-3 h-3" />
                Builtin
              </Badge>
            )}
          </h1>
          {isEdit && (
            <p className="text-sm text-muted-foreground mt-0.5">
              Utilisé par {usageCount} champ{usageCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {isEdit && !builtin && (
            <Button variant="outline" onClick={() => setShowDelete(true)} className="text-destructive">
              <Trash2 className="w-4 h-4 mr-1" />
              Supprimer
            </Button>
          )}
          <Button onClick={save} disabled={saving || !form.name || !form.errorMsg}>
            <Save className="w-4 h-4 mr-1" />
            {saving ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* Main form */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nom *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Nom de famille"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Catégorie</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => v && update("category", v)}
                  >
                    <SelectTrigger className="w-full">
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
                  onChange={(e) => update("description", e.target.value)}
                  rows={2}
                  placeholder="Lettres, espaces, tirets et apostrophes uniquement."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Type de champ *</Label>
                  <Select
                    value={form.fieldType}
                    onValueChange={(v) => v && update("fieldType", v)}
                  >
                    <SelectTrigger className="w-full">
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
                    onValueChange={(v) => update("belgianType", !v || v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger className="w-full">
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Règles de validation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Alert>
                <Lightbulb className="w-4 h-4" />
                <AlertDescription className="text-xs">
                  Toutes les règles ci-dessous sont optionnelles et combinées en <b>ET logique</b>.
                  Pour les dates, vous pouvez utiliser <code>today</code> ou <code>@field_id</code>{" "}
                  pour référencer un autre champ du formulaire.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Regex</Label>
                  <Input
                    value={form.regex}
                    onChange={(e) => update("regex", e.target.value)}
                    placeholder="^[A-Za-z]+$"
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Flags regex</Label>
                  <Input
                    value={form.regexFlags}
                    onChange={(e) => update("regexFlags", e.target.value)}
                    placeholder="i"
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Long. min</Label>
                  <Input
                    type="number"
                    value={form.minLength}
                    onChange={(e) => update("minLength", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Long. max</Label>
                  <Input
                    type="number"
                    value={form.maxLength}
                    onChange={(e) => update("maxLength", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Valeur min</Label>
                  <Input
                    type="number"
                    step="any"
                    value={form.minValue}
                    onChange={(e) => update("minValue", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Valeur max</Label>
                  <Input
                    type="number"
                    step="any"
                    value={form.maxValue}
                    onChange={(e) => update("maxValue", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Date min</Label>
                  <Input
                    value={form.minDate}
                    onChange={(e) => update("minDate", e.target.value)}
                    placeholder="today, 1900-01-01, @field_id"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Date max</Label>
                  <Input
                    value={form.maxDate}
                    onChange={(e) => update("maxDate", e.target.value)}
                    placeholder="today, @field_id"
                  />
                </div>
              </div>

              <div className="border-t pt-3 space-y-3">
                <Label className="text-sm font-medium">Règle cross-field</Label>
                <p className="text-xs text-muted-foreground">
                  Compare la valeur saisie à un autre champ du même formulaire.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Select
                    value={form.crossFieldRuleType || "__none__"}
                    onValueChange={(v) =>
                      update("crossFieldRuleType", !v || v === "__none__" ? "" : v)
                    }
                  >
                    <SelectTrigger className="w-full">
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
                  <Input
                    value={form.crossFieldRuleFieldId}
                    onChange={(e) => update("crossFieldRuleFieldId", e.target.value)}
                    placeholder="date_debut"
                    disabled={!form.crossFieldRuleType}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Messages utilisateur</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Message d&apos;erreur (FR) *</Label>
                <Input
                  value={form.errorMsg}
                  onChange={(e) => update("errorMsg", e.target.value)}
                  placeholder="Nom invalide. Lettres, espaces, tirets uniquement."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Message d&apos;erreur (NL)</Label>
                <Input
                  value={form.errorMsgNl}
                  onChange={(e) => update("errorMsgNl", e.target.value)}
                  placeholder="Ongeldig…"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Texte d&apos;aide (FR)</Label>
                  <Input
                    value={form.helpText}
                    onChange={(e) => update("helpText", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Aide (NL)</Label>
                  <Input
                    value={form.helpTextNl}
                    onChange={(e) => update("helpTextNl", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Placeholder (FR)</Label>
                  <Input
                    value={form.placeholder}
                    onChange={(e) => update("placeholder", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Placeholder (NL)</Label>
                  <Input
                    value={form.placeholderNl}
                    onChange={(e) => update("placeholderNl", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: tester regex */}
        <div className="space-y-4 lg:sticky lg:top-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TestTube2 className="w-4 h-4" />
                Tester la regex
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Valeur de test</Label>
                <Input
                  value={testValue}
                  onChange={(e) => {
                    setTestValue(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder="Tapez une valeur à tester"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={testRegex}
                disabled={!form.regex || !testValue}
                className="w-full"
              >
                Tester
              </Button>
              {testResult === "valid" && (
                <Alert className="bg-green-50 border-green-300 dark:bg-green-950 dark:border-green-800">
                  <AlertDescription className="text-green-700 dark:text-green-400 text-xs">
                    ✓ Match — la valeur passe la regex.
                  </AlertDescription>
                </Alert>
              )}
              {testResult === "invalid" && (
                <Alert variant="destructive">
                  <AlertDescription className="text-xs">
                    ✗ Pas de match — la valeur serait rejetée.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Aperçu JSON</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-[10px] bg-muted p-2 rounded overflow-x-auto">
                {JSON.stringify(buildPayload(), null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce preset ?</AlertDialogTitle>
            <AlertDialogDescription>
              {usageCount > 0 ? (
                <>
                  Ce preset est utilisé par <b>{usageCount} champ(s)</b>. Sa suppression laissera ces
                  champs sans preset (ils garderont leur propre validation).
                </>
              ) : (
                <>Cette action est irréversible.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
