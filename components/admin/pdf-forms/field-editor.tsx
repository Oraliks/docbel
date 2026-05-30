"use client";

import { Trash2Icon, GripVerticalIcon } from "lucide-react";
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  PdfFormField, FieldOption, Locale, Localized, SEMANTIC_FIELD_TYPES, FIELD_TYPE_LABELS, PrefillSource, ConditionOp, NameOrder,
} from "@/lib/pdf-forms/types";

interface PresetOpt {
  key: string;
  label: string;
}

/// Sources de pré-remplissage groupées et libellées, pour qu'on identifie
/// chaque source au premier coup d'œil dans le select admin.
const PREFILL_GROUPS: Array<{
  label: string;
  sources: Array<{ value: PrefillSource; label: string; hint?: string }>;
}> = [
  {
    label: "Automatique (généré par le système)",
    sources: [
      {
        value: "system.today",
        label: "Date du jour (date de génération)",
        hint: "Le champ sera pré-rempli automatiquement et en lecture seule côté utilisateur.",
      },
    ],
  },
  {
    label: "Identité vérifiée (itsme)",
    sources: [
      { value: "itsme.firstName", label: "Prénom (itsme)" },
      { value: "itsme.lastName", label: "Nom (itsme)" },
      { value: "itsme.niss", label: "NISS (itsme)" },
      { value: "itsme.birthDate", label: "Date de naissance (itsme)" },
      { value: "itsme.gender", label: "Sexe (itsme)" },
      { value: "itsme.street", label: "Rue (itsme)" },
      { value: "itsme.postalCode", label: "Code postal (itsme)" },
      { value: "itsme.city", label: "Ville (itsme)" },
    ],
  },
  {
    label: "Profil utilisateur",
    sources: [
      { value: "profile.firstName", label: "Prénom (profil)" },
      { value: "profile.lastName", label: "Nom (profil)" },
      { value: "profile.niss", label: "NISS (profil)" },
      { value: "profile.email", label: "E-mail (profil)" },
      { value: "profile.phone", label: "Téléphone (profil)" },
      { value: "profile.iban", label: "IBAN (profil)" },
      { value: "profile.street", label: "Rue (profil)" },
      { value: "profile.postalCode", label: "Code postal (profil)" },
      { value: "profile.city", label: "Ville (profil)" },
    ],
  },
];

function findPrefillSource(value: PrefillSource | undefined) {
  if (!value) return undefined;
  for (const g of PREFILL_GROUPS) {
    const f = g.sources.find((s) => s.value === value);
    if (f) return f;
  }
  return undefined;
}

const OPS: ConditionOp[] = ["equals", "notEquals", "in", "notIn"];
const OP_LABELS: Record<ConditionOp, string> = {
  equals: "est égal à",
  notEquals: "est différent de",
  in: "fait partie de",
  notIn: "ne fait pas partie de",
};

interface Props {
  field: PdfFormField;
  locales: Locale[];
  presets: PresetOpt[];
  allFields: PdfFormField[];
  onChange: (next: PdfFormField) => void;
  onRemove: () => void;
}

export function FieldEditor({ field, locales, presets, allFields, onChange, onRemove }: Props) {
  const patch = (p: Partial<PdfFormField>) => onChange({ ...field, ...p });
  const setLocalized = (key: "label" | "help" | "placeholder", lng: Locale, v: string) =>
    patch({ [key]: { ...(field[key] as Localized), [lng]: v } } as Partial<PdfFormField>);

  const isChoice = field.type === "select" || field.type === "radio";

  return (
    <AccordionItem value={field.id} className="rounded-lg border px-3">
      <AccordionTrigger className="py-2.5 hover:no-underline">
        <div className="flex flex-1 items-center gap-2 text-left">
          <GripVerticalIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="font-medium">{field.label.fr || field.id}</span>
          <Badge variant="outline" className="text-[10px]">{FIELD_TYPE_LABELS[field.type]}</Badge>
          {field.required && <Badge variant="secondary" className="text-[10px]">requis</Badge>}
          <code className="ml-auto truncate text-[11px] text-muted-foreground">{field.pdfFieldName}</code>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-4">
        <div className="flex flex-col gap-4">
          {/* Libellés multilingues */}
          <div className="grid gap-2 sm:grid-cols-3">
            {locales.map((lng) => (
              <div key={lng} className="flex flex-col gap-1">
                <Label className="text-xs uppercase text-muted-foreground">Libellé {lng}</Label>
                <Input
                  value={field.label[lng] ?? ""}
                  onChange={(e) => setLocalized("label", lng, e.target.value)}
                />
              </div>
            ))}
          </div>

          {/* Type / requis / section */}
          <div className="grid items-end gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Select value={field.type} onValueChange={(v) => patch({ type: v as PdfFormField["type"] })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEMANTIC_FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{FIELD_TYPE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Section</Label>
              <Input value={field.section ?? ""} placeholder="identite, adresse…" onChange={(e) => patch({ section: e.target.value || undefined })} />
            </div>
            <div className="flex flex-col gap-1 pb-1">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={field.required} onCheckedChange={(c) => patch({ required: c })} />
                Champ obligatoire
              </label>
              <p className="text-[11px] text-muted-foreground">
                Si activé, le formulaire ne pourra pas être envoyé tant que ce champ est vide.
              </p>
            </div>
          </div>

          {/* Aide (FR) */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Aide (FR)</Label>
            <Input value={field.help?.fr ?? ""} onChange={(e) => setLocalized("help", "fr", e.target.value)} />
          </div>

          {/* Options pour select/radio */}
          {isChoice && (
            <OptionsEditor
              options={field.options ?? []}
              onChange={(options) => patch({ options })}
            />
          )}

          {/* Ordre d'affichage pour le champ nom complet (fullname) */}
          {field.type === "fullname" && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">
                Ordre des sous-champs (2 inputs front → 1 champ PDF)
              </Label>
              <Select
                value={field.nameOrder ?? "first-last"}
                onValueChange={(v) => patch({ nameOrder: v as NameOrder })}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="first-last">Prénom puis Nom</SelectItem>
                  <SelectItem value="last-first">Nom puis Prénom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <Separator />

          {/* Validation : preset + regex + contraintes de longueur / plage */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Preset</Label>
              <Select value={field.presetKey ?? ""} onValueChange={(v) => patch({ presetKey: v || undefined })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun</SelectItem>
                  {presets.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Regex (ancrée)</Label>
              <Input value={field.regex ?? ""} placeholder="\d{4}" onChange={(e) => patch({ regex: e.target.value || undefined })} />
            </div>
            {field.type === "number" ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Min</Label>
                  <Input
                    type="number"
                    value={field.min ?? ""}
                    onChange={(e) => patch({ min: e.target.value === "" ? undefined : Number(e.target.value) })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Max</Label>
                  <Input
                    type="number"
                    value={field.max ?? ""}
                    onChange={(e) => patch({ max: e.target.value === "" ? undefined : Number(e.target.value) })}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Longueur min</Label>
                  <Input
                    type="number"
                    value={field.minLength ?? ""}
                    onChange={(e) => patch({ minLength: e.target.value === "" ? undefined : Number(e.target.value) })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Longueur max</Label>
                  <Input
                    type="number"
                    value={field.maxLength ?? ""}
                    onChange={(e) => patch({ maxLength: e.target.value === "" ? undefined : Number(e.target.value) })}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Prefill — groupé + libellé lisible + hint contextuel */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Pré-remplissage automatique</Label>
            <Select
              value={field.prefillFrom ?? ""}
              onValueChange={(v) => patch({ prefillFrom: (v || undefined) as PrefillSource | undefined })}
            >
              <SelectTrigger className="w-full"><SelectValue placeholder="Aucun (l'utilisateur saisit)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Aucun (l&apos;utilisateur saisit)</SelectItem>
                {PREFILL_GROUPS.map((group) => (
                  <SelectGroup key={group.label}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.sources.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            {findPrefillSource(field.prefillFrom)?.hint && (
              <p className="text-[11px] text-muted-foreground">
                {findPrefillSource(field.prefillFrom)?.hint}
              </p>
            )}
          </div>

          {/* Visibilité conditionnelle */}
          <VisibleIfEditor field={field} allFields={allFields} onChange={onChange} />

          {/* Note interne */}
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Note interne (jamais affichée à l&apos;utilisateur)</Label>
            <Textarea
              rows={2}
              value={field.internalNote ?? ""}
              onChange={(e) => patch({ internalNote: e.target.value || undefined })}
            />
          </div>

          <Button variant="ghost" size="sm" className="w-fit text-destructive" onClick={onRemove}>
            <Trash2Icon className="size-4" /> Retirer ce champ
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function OptionsEditor({ options, onChange }: { options: FieldOption[]; onChange: (o: FieldOption[]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs text-muted-foreground">Options</Label>
      {options.map((o, i) => (
        <div key={i} className="flex gap-2">
          <Input
            className="w-1/3"
            value={o.value}
            placeholder="valeur"
            onChange={(e) => onChange(options.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
          />
          <Input
            value={o.label.fr ?? ""}
            placeholder="libellé FR"
            onChange={(e) => onChange(options.map((x, j) => (j === i ? { ...x, label: { ...x.label, fr: e.target.value } } : x)))}
          />
          <Button variant="ghost" size="icon" onClick={() => onChange(options.filter((_, j) => j !== i))}>
            <Trash2Icon className="size-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-fit" onClick={() => onChange([...options, { value: "", label: { fr: "" } }])}>
        Ajouter une option
      </Button>
    </div>
  );
}

function VisibleIfEditor({
  field, allFields, onChange,
}: {
  field: PdfFormField;
  allFields: PdfFormField[];
  onChange: (next: PdfFormField) => void;
}) {
  const cond = field.visibleIf;
  const others = allFields.filter((f) => f.id !== field.id);

  return (
    <div className="flex flex-col gap-2 rounded-md bg-muted/40 p-3">
      <label className="flex items-center gap-2 text-sm">
        <Switch
          checked={!!cond}
          onCheckedChange={(c) =>
            onChange({ ...field, visibleIf: c ? { fieldId: others[0]?.id ?? "", op: "equals", value: "" } : undefined })
          }
        />
        Affichage conditionnel
      </label>
      {cond && (
        <div className="grid gap-2 sm:grid-cols-3">
          <Select value={cond.fieldId} onValueChange={(v) => onChange({ ...field, visibleIf: { ...cond, fieldId: v ?? "" } })}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Champ" /></SelectTrigger>
            <SelectContent>
              {others.map((f) => <SelectItem key={f.id} value={f.id}>{f.label.fr || f.id}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={cond.op} onValueChange={(v) => onChange({ ...field, visibleIf: { ...cond, op: v as ConditionOp } })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {OPS.map((o) => <SelectItem key={o} value={o}>{OP_LABELS[o]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            value={Array.isArray(cond.value) ? cond.value.join(",") : String(cond.value)}
            placeholder={cond.op === "in" || cond.op === "notIn" ? "a,b,c" : "valeur"}
            onChange={(e) => {
              const raw = e.target.value;
              const value = cond.op === "in" || cond.op === "notIn" ? raw.split(",").map((s) => s.trim()) : raw;
              onChange({ ...field, visibleIf: { ...cond, value } });
            }}
          />
        </div>
      )}
    </div>
  );
}
