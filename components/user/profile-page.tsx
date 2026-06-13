"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  BriefcaseIcon,
  CreditCardIcon,
  MapPinIcon,
  PlusIcon,
  SaveIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UserIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NissInput } from "@/components/ui/niss-input";
import {
  GLASS_CARD,
  GLASS_INPUT,
  GLASS_LABEL,
} from "@/lib/glass-classes";

/// Lien de parenté d'un membre du ménage (cf. validation API).
type HouseholdRelationship =
  | "conjoint"
  | "enfant"
  | "parent"
  | "cohabitant"
  | "autre";

const HOUSEHOLD_RELATIONSHIP_LABELS: Record<HouseholdRelationship, string> = {
  conjoint: "Conjoint(e)",
  enfant: "Enfant",
  parent: "Parent",
  cohabitant: "Cohabitant(e)",
  autre: "Autre",
};

/// Un membre de la composition de ménage. Tout est optionnel sauf le lien.
interface HouseholdMember {
  firstName: string;
  lastName: string;
  relationship: HouseholdRelationship;
  birthDate: string; // ISO court AAAA-MM-JJ
  hasRevenu: boolean;
}

const MAX_HOUSEHOLD_MEMBERS = 12;

function emptyMember(): HouseholdMember {
  return {
    firstName: "",
    lastName: "",
    relationship: "enfant",
    birthDate: "",
    hasRevenu: false,
  };
}

interface ProfileForm {
  firstName: string;
  lastName: string;
  niss: string;
  birthDate: string;
  birthPlace: string;
  nationality: string;
  gender: string;
  street: string;
  streetNum: string;
  postalCode: string;
  city: string;
  country: string;
  phone: string;
  mobilePhone: string;
  iban: string;
  bic: string;
  maritalStatus: string;
  employer: string;
  employerBce: string;
  jobTitle: string;
  contractType: string;
  contractStart: string;
  householdMembers: HouseholdMember[];
}

/// Normalise une valeur JSON brute (Prisma) en liste de membres typés.
function normalizeHouseholdMembers(raw: unknown): HouseholdMember[] {
  if (!Array.isArray(raw)) return [];
  const out: HouseholdMember[] = [];
  for (const m of raw) {
    if (typeof m !== "object" || m === null) continue;
    const rec = m as Record<string, unknown>;
    const rel = rec.relationship;
    const relationship: HouseholdRelationship =
      typeof rel === "string" && rel in HOUSEHOLD_RELATIONSHIP_LABELS
        ? (rel as HouseholdRelationship)
        : "autre";
    out.push({
      firstName: typeof rec.firstName === "string" ? rec.firstName : "",
      lastName: typeof rec.lastName === "string" ? rec.lastName : "",
      relationship,
      birthDate:
        typeof rec.birthDate === "string" ? rec.birthDate.slice(0, 10) : "",
      hasRevenu: rec.hasRevenu === true,
    });
  }
  return out.slice(0, MAX_HOUSEHOLD_MEMBERS);
}

const EMPTY: ProfileForm = {
  firstName: "",
  lastName: "",
  niss: "",
  birthDate: "",
  birthPlace: "",
  nationality: "BE",
  gender: "",
  street: "",
  streetNum: "",
  postalCode: "",
  city: "",
  country: "BE",
  phone: "",
  mobilePhone: "",
  iban: "",
  bic: "",
  maritalStatus: "",
  employer: "",
  employerBce: "",
  jobTitle: "",
  contractType: "",
  contractStart: "",
  householdMembers: [],
};

/// Le `initial` venant du serveur peut ne pas porter `householdMembers`
/// (champ JSON ajouté après coup) : on le rend optionnel et on hydrate la
/// composition de ménage côté client au montage si besoin.
type InitialProfile = Omit<ProfileForm, "householdMembers"> &
  Partial<Pick<ProfileForm, "householdMembers">>;

interface ProfilePageProps {
  initial: InitialProfile | null;
  userName: string;
  userEmail: string;
}

export function ProfilePage({
  initial,
  userName,
  userEmail,
}: ProfilePageProps) {
  const router = useRouter();
  const [form, setForm] = useState<ProfileForm>(
    initial
      ? { ...EMPTY, ...initial, householdMembers: initial.householdMembers ?? [] }
      : EMPTY
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Le serveur ne propage pas toujours `householdMembers` dans `initial` :
  // on hydrate la composition de ménage depuis l'API au montage si elle n'a
  // pas été fournie. N'écrase pas une saisie en cours (dirty).
  useEffect(() => {
    if (initial?.householdMembers !== undefined) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/user/profile");
        if (!res.ok) return;
        const j = await res.json();
        const members = normalizeHouseholdMembers(j?.householdMembers);
        if (cancelled || members.length === 0) return;
        setForm((prev) =>
          prev.householdMembers.length > 0
            ? prev
            : { ...prev, householdMembers: members }
        );
      } catch {
        // silencieux : la section reste vide, l'utilisateur peut ajouter.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function updateMember<K extends keyof HouseholdMember>(
    index: number,
    key: K,
    value: HouseholdMember[K]
  ) {
    setForm((prev) => ({
      ...prev,
      householdMembers: prev.householdMembers.map((m, i) =>
        i === index ? { ...m, [key]: value } : m
      ),
    }));
    setDirty(true);
  }

  function addMember() {
    setForm((prev) =>
      prev.householdMembers.length >= MAX_HOUSEHOLD_MEMBERS
        ? prev
        : { ...prev, householdMembers: [...prev.householdMembers, emptyMember()] }
    );
    setDirty(true);
  }

  function removeMember(index: number) {
    setForm((prev) => ({
      ...prev,
      householdMembers: prev.householdMembers.filter((_, i) => i !== index),
    }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Échec");
      }
      toast.success("Profil enregistré");
      setDirty(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProfile() {
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", { method: "DELETE" });
      if (!res.ok) throw new Error("Échec");
      setForm(EMPTY);
      toast.success("Profil effacé");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12.5px] text-[color:var(--glass-ink-soft)]">
          {userName} · {userEmail}
        </p>
        <Button
          onClick={save}
          disabled={saving || !dirty}
          className="rounded-full px-5 py-2.5 text-[13px] font-bold disabled:opacity-50"
          style={{
            background: "var(--glass-ink)",
            color: "var(--glass-bg-a)",
          }}
        >
          <SaveIcon className="size-4" />
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>

      <div
        className="flex items-start gap-3 rounded-2xl p-4 text-[13px]"
        style={{
          background: "rgba(159, 124, 255, 0.12)",
          color: "var(--glass-ink-soft)",
        }}
      >
        <ShieldCheckIcon
          className="mt-0.5 size-4 shrink-0"
          style={{ color: "var(--glass-accent-deep)" }}
        />
        <p>
          Vos informations sont stockées de manière sécurisée et utilisées
          uniquement pour pré-remplir vos formulaires automatiquement. Vous
          pouvez les supprimer à tout moment.
        </p>
      </div>

      <Card className={GLASS_CARD}>
        <CardHeader className="px-6 pt-6 pb-3">
          <CardTitle className="glass-display flex items-center gap-2 text-[20px] font-semibold">
            <UserIcon className="size-4 text-[color:var(--glass-accent-deep)]" />
            Identité
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 px-6 pb-6 md:grid-cols-2">
          <Field label="Prénom">
            <Input
              className={GLASS_INPUT}
              value={form.firstName}
              onChange={(e) => update("firstName", e.target.value)}
            />
          </Field>
          <Field label="Nom">
            <Input
              className={GLASS_INPUT}
              value={form.lastName}
              onChange={(e) => update("lastName", e.target.value)}
            />
          </Field>
          <Field label="NISS">
            <NissInput
              className={GLASS_INPUT}
              value={form.niss}
              onChange={(v) => update("niss", v)}
            />
          </Field>
          <Field label="Date de naissance">
            <Input
              type="date"
              className={GLASS_INPUT}
              value={form.birthDate}
              onChange={(e) => update("birthDate", e.target.value)}
            />
          </Field>
          <Field label="Lieu de naissance">
            <Input
              className={GLASS_INPUT}
              value={form.birthPlace}
              onChange={(e) => update("birthPlace", e.target.value)}
            />
          </Field>
          <Field label="Nationalité">
            <Input
              className={GLASS_INPUT}
              value={form.nationality}
              onChange={(e) => update("nationality", e.target.value)}
            />
          </Field>
          <Field label="Sexe">
            <Select
              value={form.gender || "__none__"}
              onValueChange={(v) =>
                update("gender", !v || v === "__none__" ? "" : v)
              }
            >
              <SelectTrigger className={`${GLASS_INPUT} w-full`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Non précisé —</SelectItem>
                <SelectItem value="M">Masculin</SelectItem>
                <SelectItem value="F">Féminin</SelectItem>
                <SelectItem value="X">Autre</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="État civil">
            <Select
              value={form.maritalStatus || "__none__"}
              onValueChange={(v) =>
                update("maritalStatus", !v || v === "__none__" ? "" : v)
              }
            >
              <SelectTrigger className={`${GLASS_INPUT} w-full`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Non précisé —</SelectItem>
                <SelectItem value="single">Célibataire</SelectItem>
                <SelectItem value="married">Marié(e)</SelectItem>
                <SelectItem value="cohabiting">Cohabitant(e) légal(e)</SelectItem>
                <SelectItem value="divorced">Divorcé(e)</SelectItem>
                <SelectItem value="widowed">Veuf/Veuve</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card className={GLASS_CARD}>
        <CardHeader className="px-6 pt-6 pb-3">
          <CardTitle className="glass-display flex items-center gap-2 text-[20px] font-semibold">
            <MapPinIcon className="size-4 text-[color:var(--glass-accent-deep)]" />
            Adresse et contact
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 px-6 pb-6 md:grid-cols-2">
          <div className="grid grid-cols-[1fr_120px] gap-4 md:col-span-2">
            <Field label="Rue">
              <Input
                className={GLASS_INPUT}
                value={form.street}
                onChange={(e) => update("street", e.target.value)}
              />
            </Field>
            <Field label="Numéro">
              <Input
                className={GLASS_INPUT}
                value={form.streetNum}
                onChange={(e) => update("streetNum", e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-4 md:col-span-2">
            <Field label="Code postal">
              <Input
                className={GLASS_INPUT}
                value={form.postalCode}
                onChange={(e) => update("postalCode", e.target.value)}
                inputMode="numeric"
                placeholder="1000"
              />
            </Field>
            <Field label="Ville">
              <Input
                className={GLASS_INPUT}
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Téléphone">
            <Input
              className={GLASS_INPUT}
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="+32 2 123 45 67"
            />
          </Field>
          <Field label="GSM">
            <Input
              className={GLASS_INPUT}
              value={form.mobilePhone}
              onChange={(e) => update("mobilePhone", e.target.value)}
              placeholder="+32 470 12 34 56"
            />
          </Field>
        </CardContent>
      </Card>

      <Card className={GLASS_CARD}>
        <CardHeader className="px-6 pt-6 pb-3">
          <CardTitle className="glass-display flex items-center gap-2 text-[20px] font-semibold">
            <UsersIcon className="size-4 text-[color:var(--glass-accent-deep)]" />
            Composition de ménage
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-6 pb-6">
          <p className="text-[12.5px] text-[color:var(--glass-ink-soft)]">
            Les personnes qui vivent sous votre toit (conjoint, enfants,
            cohabitants…). Utile pour les formulaires qui demandent la
            composition de ménage.
          </p>

          {form.householdMembers.length === 0 ? (
            <p className="text-[13px] text-[color:var(--glass-ink-faint)]">
              Aucun membre ajouté.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {form.householdMembers.map((member, i) => (
                <div
                  key={i}
                  className="relative grid gap-3 rounded-2xl p-4 md:grid-cols-2"
                  style={{ background: "var(--glass-surface)" }}
                >
                  <button
                    type="button"
                    onClick={() => removeMember(i)}
                    aria-label="Retirer ce membre"
                    className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full transition-colors hover:bg-[color:var(--glass-pop-bg)]/40"
                    style={{ color: "var(--glass-ink-soft)" }}
                  >
                    <XIcon className="size-4" />
                  </button>
                  <Field label="Prénom">
                    <Input
                      className={GLASS_INPUT}
                      value={member.firstName}
                      onChange={(e) => updateMember(i, "firstName", e.target.value)}
                    />
                  </Field>
                  <Field label="Nom">
                    <Input
                      className={GLASS_INPUT}
                      value={member.lastName}
                      onChange={(e) => updateMember(i, "lastName", e.target.value)}
                    />
                  </Field>
                  <Field label="Lien de parenté">
                    <Select
                      value={member.relationship}
                      onValueChange={(v) =>
                        updateMember(i, "relationship", v as HouseholdRelationship)
                      }
                    >
                      <SelectTrigger className={`${GLASS_INPUT} w-full`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          Object.keys(
                            HOUSEHOLD_RELATIONSHIP_LABELS
                          ) as HouseholdRelationship[]
                        ).map((rel) => (
                          <SelectItem key={rel} value={rel}>
                            {HOUSEHOLD_RELATIONSHIP_LABELS[rel]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Date de naissance">
                    <Input
                      type="date"
                      className={GLASS_INPUT}
                      value={member.birthDate}
                      onChange={(e) => updateMember(i, "birthDate", e.target.value)}
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-[13px] text-[color:var(--glass-ink-soft)] md:col-span-2">
                    <input
                      type="checkbox"
                      checked={member.hasRevenu}
                      onChange={(e) =>
                        updateMember(i, "hasRevenu", e.target.checked)
                      }
                      className="size-4 rounded border-[color:var(--glass-border)] accent-[color:var(--glass-accent-deep)]"
                    />
                    A des revenus propres
                  </label>
                </div>
              ))}
            </div>
          )}

          <div>
            <Button
              type="button"
              variant="outline"
              onClick={addMember}
              disabled={form.householdMembers.length >= MAX_HOUSEHOLD_MEMBERS}
              className="rounded-full border-[color:var(--glass-border)] bg-transparent text-[13px] disabled:opacity-50"
              style={{ color: "var(--glass-ink)" }}
            >
              <PlusIcon className="size-4" />
              Ajouter un membre
            </Button>
            {form.householdMembers.length >= MAX_HOUSEHOLD_MEMBERS && (
              <p className="mt-2 text-[12px] text-[color:var(--glass-ink-faint)]">
                Maximum {MAX_HOUSEHOLD_MEMBERS} membres.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className={GLASS_CARD}>
        <CardHeader className="px-6 pt-6 pb-3">
          <CardTitle className="glass-display flex items-center gap-2 text-[20px] font-semibold">
            <CreditCardIcon className="size-4 text-[color:var(--glass-accent-deep)]" />
            Coordonnées bancaires
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 px-6 pb-6 md:grid-cols-[2fr_1fr]">
          <Field label="IBAN">
            <Input
              className={GLASS_INPUT}
              value={form.iban}
              onChange={(e) => update("iban", e.target.value.toUpperCase())}
              placeholder="BE00 0000 0000 0000"
            />
          </Field>
          <Field label="BIC (optionnel)">
            <Input
              className={GLASS_INPUT}
              value={form.bic}
              onChange={(e) => update("bic", e.target.value.toUpperCase())}
            />
          </Field>
        </CardContent>
      </Card>

      <Card className={GLASS_CARD}>
        <CardHeader className="px-6 pt-6 pb-3">
          <CardTitle className="glass-display flex items-center gap-2 text-[20px] font-semibold">
            <BriefcaseIcon className="size-4 text-[color:var(--glass-accent-deep)]" />
            Situation professionnelle
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 px-6 pb-6 md:grid-cols-2">
          <Field label="Employeur">
            <Input
              className={GLASS_INPUT}
              value={form.employer}
              onChange={(e) => update("employer", e.target.value)}
            />
          </Field>
          <Field label="N° BCE employeur">
            <Input
              className={GLASS_INPUT}
              value={form.employerBce}
              onChange={(e) => update("employerBce", e.target.value)}
              placeholder="0123.456.789"
            />
          </Field>
          <Field label="Fonction">
            <Input
              className={GLASS_INPUT}
              value={form.jobTitle}
              onChange={(e) => update("jobTitle", e.target.value)}
            />
          </Field>
          <Field label="Type de contrat">
            <Select
              value={form.contractType || "__none__"}
              onValueChange={(v) =>
                update("contractType", !v || v === "__none__" ? "" : v)
              }
            >
              <SelectTrigger className={`${GLASS_INPUT} w-full`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Non précisé —</SelectItem>
                <SelectItem value="CDI">CDI</SelectItem>
                <SelectItem value="CDD">CDD</SelectItem>
                <SelectItem value="interim">Intérim</SelectItem>
                <SelectItem value="independant">Indépendant</SelectItem>
                <SelectItem value="student">Étudiant</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Date d'entrée en service">
            <Input
              type="date"
              className={GLASS_INPUT}
              value={form.contractStart}
              onChange={(e) => update("contractStart", e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card className={GLASS_CARD}>
        <CardHeader className="px-6 pt-6 pb-3">
          <CardTitle
            className="glass-display flex items-center gap-2 text-[18px] font-semibold"
            style={{ color: "#b8324a" }}
          >
            Zone dangereuse
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <p className="mb-3 text-[12.5px] text-[color:var(--glass-ink-soft)]">
            Supprimer toutes les données de votre profil. Vos formulaires
            précédemment générés ne sont pas affectés.
          </p>
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="outline"
                  className="rounded-full border-0"
                  style={{
                    background: "rgba(220, 80, 100, 0.12)",
                    color: "#b8324a",
                  }}
                >
                  <Trash2Icon className="size-4" />
                  Effacer mon profil
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Effacer toutes les données ?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. Vos préférences de
                  pré-remplissage seront perdues.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={deleteProfile}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Effacer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className={GLASS_LABEL}>{label}</Label>
      {children}
    </div>
  );
}
