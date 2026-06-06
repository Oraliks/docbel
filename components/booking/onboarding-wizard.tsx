"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORY_LABELS } from "@/lib/booking/status";

const CATEGORIES = ["unemployment", "social_aid", "municipal", "private", "other"];
const WEEKDAYS = [
  { v: 1, l: "Lun" },
  { v: 2, l: "Mar" },
  { v: 3, l: "Mer" },
  { v: 4, l: "Jeu" },
  { v: 5, l: "Ven" },
  { v: 6, l: "Sam" },
  { v: 0, l: "Dim" },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

const STEPS = ["Organisation", "Antenne", "Créneaux", "Terminé"];

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [tenant, setTenant] = useState<{ id: string; slug: string } | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);

  const [org, setOrg] = useState({
    name: "",
    slug: "",
    category: "private",
    partnerOrganization: "",
  });
  const [slugEdited, setSlugEdited] = useState(false);
  const [loc, setLoc] = useState({ name: "", street: "", postalCode: "", city: "" });
  const [slots, setSlots] = useState({
    weekdays: [1, 2, 3, 4, 5] as number[],
    startTime: "09:00",
    endTime: "17:00",
    slotDuration: 30,
    capacity: 1,
  });

  async function createTenant() {
    if (!org.name.trim() || !org.slug.trim()) {
      toast.error("Nom et slug requis");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/booking/partner/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: org.name.trim(),
          slug: org.slug.trim(),
          category: org.category,
          partnerOrganization: org.partnerOrganization.trim() || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error ?? "Erreur lors de la création");
        return;
      }
      setTenant({ id: d.id, slug: d.slug ?? org.slug.trim() });
      setStep(2);
    } finally {
      setSaving(false);
    }
  }

  async function createLocation() {
    if (!tenant) return;
    if (!loc.name.trim()) {
      toast.error("Le nom de l'antenne est requis");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/booking/partner/tenants/${tenant.id}/locations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: loc.name.trim(),
          street: loc.street.trim() || null,
          postalCode: loc.postalCode.trim() || null,
          city: loc.city.trim() || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error ?? "Erreur lors de la création de l'antenne");
        return;
      }
      setLocationId(d.id);
      setStep(3);
    } finally {
      setSaving(false);
    }
  }

  async function createSlots() {
    if (!tenant || !locationId) return;
    if (slots.weekdays.length === 0) {
      toast.error("Choisissez au moins un jour");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/booking/partner/tenants/${tenant.id}/rules/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          weekdays: slots.weekdays,
          startTime: slots.startTime,
          endTime: slots.endTime,
          slotDuration: slots.slotDuration,
          capacity: slots.capacity,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error ?? "Erreur lors de la génération des créneaux");
        return;
      }
      toast.success("Créneaux générés");
      setStep(4);
    } finally {
      setSaving(false);
    }
  }

  function toggleDay(v: number) {
    setSlots((s) => ({
      ...s,
      weekdays: s.weekdays.includes(v)
        ? s.weekdays.filter((d) => d !== v)
        : [...s.weekdays, v],
    }));
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      {/* Indicateur d'étapes */}
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = step > n;
          const active = step === n;
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  done
                    ? "bg-emerald-600 text-white"
                    : active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? <Check className="size-4" /> : n}
              </span>
              <span className={active ? "font-medium" : "text-muted-foreground"}>
                {label}
              </span>
              {n < STEPS.length && (
                <ChevronRight className="size-4 text-muted-foreground" />
              )}
            </li>
          );
        })}
      </ol>

      <div className="rounded-xl border p-6">
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">Organisation</h2>
            <div className="flex flex-col gap-1.5">
              <Label>Nom de l&apos;organisation</Label>
              <Input
                value={org.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setOrg((o) => ({
                    ...o,
                    name,
                    ...(slugEdited ? {} : { slug: slugify(name) }),
                  }));
                }}
                placeholder="Ex : CPAS de Namur, Entreprise Dupont…"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Slug (URL publique)</Label>
              <Input
                value={org.slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setOrg((o) => ({ ...o, slug: slugify(e.target.value) }));
                }}
                placeholder="cpas-namur"
              />
              <p className="text-xs text-muted-foreground">
                Page publique : <code>/{org.slug || "slug"}/rendez-vous</code>
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Catégorie</Label>
              <Select
                value={org.category}
                onValueChange={(v) => setOrg((o) => ({ ...o, category: v ?? "private" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABELS[c] ?? c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Organisation partenaire (optionnel)</Label>
              <Input
                value={org.partnerOrganization}
                onChange={(e) =>
                  setOrg((o) => ({ ...o, partnerOrganization: e.target.value }))
                }
                placeholder="Ex : FGTB"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={createTenant} disabled={saving}>
                {saving ? "Création…" : "Continuer"}
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">Première antenne</h2>
            <p className="text-sm text-muted-foreground">
              Le lieu où les citoyens se présenteront. Vous pourrez en ajouter
              d&apos;autres plus tard.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label>Nom de l&apos;antenne</Label>
              <Input
                value={loc.name}
                onChange={(e) => setLoc((l) => ({ ...l, name: e.target.value }))}
                placeholder="Ex : Bureau central"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Rue (optionnel)</Label>
              <Input
                value={loc.street}
                onChange={(e) => setLoc((l) => ({ ...l, street: e.target.value }))}
                placeholder="Rue de la Loi 1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Code postal</Label>
                <Input
                  value={loc.postalCode}
                  onChange={(e) => setLoc((l) => ({ ...l, postalCode: e.target.value }))}
                  placeholder="5000"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Ville</Label>
                <Input
                  value={loc.city}
                  onChange={(e) => setLoc((l) => ({ ...l, city: e.target.value }))}
                  placeholder="Namur"
                />
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} disabled={saving}>
                Retour
              </Button>
              <Button onClick={createLocation} disabled={saving}>
                {saving ? "Enregistrement…" : "Continuer"}
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">Créneaux hebdomadaires</h2>
            <p className="text-sm text-muted-foreground">
              Génère automatiquement les créneaux récurrents. Ajustable ensuite
              dans l&apos;onglet Créneaux.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label>Jours d&apos;ouverture</Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((d) => {
                  const on = slots.weekdays.includes(d.v);
                  return (
                    <button
                      key={d.v}
                      type="button"
                      onClick={() => toggleDay(d.v)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input hover:bg-accent"
                      }`}
                    >
                      {d.l}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="flex flex-col gap-1.5">
                <Label>Début</Label>
                <Input
                  type="time"
                  value={slots.startTime}
                  onChange={(e) => setSlots((s) => ({ ...s, startTime: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Fin</Label>
                <Input
                  type="time"
                  value={slots.endTime}
                  onChange={(e) => setSlots((s) => ({ ...s, endTime: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Durée (min)</Label>
                <Input
                  type="number"
                  min={5}
                  value={slots.slotDuration}
                  onChange={(e) =>
                    setSlots((s) => ({ ...s, slotDuration: Number(e.target.value) }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Capacité</Label>
                <Input
                  type="number"
                  min={1}
                  value={slots.capacity}
                  onChange={(e) =>
                    setSlots((s) => ({ ...s, capacity: Number(e.target.value) }))
                  }
                />
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)} disabled={saving}>
                Retour
              </Button>
              <Button onClick={createSlots} disabled={saving}>
                {saving ? "Génération…" : "Générer les créneaux"}
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 4 && tenant && (
          <div className="flex flex-col gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
              <Check className="size-6 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold">Guichet opérationnel 🎉</h2>
            <p className="text-sm text-muted-foreground">
              Votre guichet est actif et déjà accessible au public. Prochaine
              étape recommandée : personnaliser le formulaire citoyen.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => router.push(`/admin/booking/${tenant.id}/configuration`)}>
                Personnaliser le formulaire
                <ChevronRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/admin/booking/${tenant.id}/agenda`)}
              >
                Aller à l&apos;agenda
              </Button>
              <a
                href={`/${tenant.slug}/rendez-vous`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Voir la page publique
                <ExternalLink className="size-4" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
