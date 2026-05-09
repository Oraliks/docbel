"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Save, User, MapPin, Briefcase, CreditCard, Trash2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
};

interface ProfilePageProps {
  initial: ProfileForm | null;
  userName: string;
  userEmail: string;
}

export function ProfilePage({ initial, userName, userEmail }: ProfilePageProps) {
  const router = useRouter();
  const [form, setForm] = useState<ProfileForm>(initial || EMPTY);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  function update<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
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
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Mon profil</h1>
          <p className="text-sm text-muted-foreground">
            {userName} · {userEmail}
          </p>
        </div>
        <Button onClick={save} disabled={saving || !dirty}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>

      <Alert>
        <ShieldCheck className="w-4 h-4" />
        <AlertDescription className="text-sm">
          Vos informations sont stockées de manière sécurisée et utilisées uniquement pour
          pré-remplir vos formulaires automatiquement. Vous pouvez les supprimer à tout moment.
        </AlertDescription>
      </Alert>

      {/* Identité */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="w-4 h-4" />
            Identité
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Prénom</Label>
            <Input value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nom</Label>
            <Input value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">NISS</Label>
            <Input
              value={form.niss}
              onChange={(e) => update("niss", e.target.value)}
              placeholder="00.00.00-000.00"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Date de naissance</Label>
            <Input
              type="date"
              value={form.birthDate}
              onChange={(e) => update("birthDate", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Lieu de naissance</Label>
            <Input value={form.birthPlace} onChange={(e) => update("birthPlace", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nationalité</Label>
            <Input value={form.nationality} onChange={(e) => update("nationality", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sexe</Label>
            <Select
              value={form.gender || "__none__"}
              onValueChange={(v) => update("gender", v === "__none__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Non précisé —</SelectItem>
                <SelectItem value="M">Masculin</SelectItem>
                <SelectItem value="F">Féminin</SelectItem>
                <SelectItem value="X">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">État civil</Label>
            <Select
              value={form.maritalStatus || "__none__"}
              onValueChange={(v) => update("maritalStatus", v === "__none__" ? "" : v)}
            >
              <SelectTrigger>
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
          </div>
        </CardContent>
      </Card>

      {/* Adresse + contact */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="w-4 h-4" />
            Adresse et contact
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2 grid grid-cols-[1fr_120px] gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Rue</Label>
              <Input value={form.street} onChange={(e) => update("street", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Numéro</Label>
              <Input value={form.streetNum} onChange={(e) => update("streetNum", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-3 md:col-span-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Code postal</Label>
              <Input
                value={form.postalCode}
                onChange={(e) => update("postalCode", e.target.value)}
                inputMode="numeric"
                placeholder="1000"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ville</Label>
              <Input value={form.city} onChange={(e) => update("city", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Téléphone</Label>
            <Input
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="+32 2 123 45 67"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">GSM</Label>
            <Input
              value={form.mobilePhone}
              onChange={(e) => update("mobilePhone", e.target.value)}
              placeholder="+32 470 12 34 56"
            />
          </div>
        </CardContent>
      </Card>

      {/* Bancaire */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="w-4 h-4" />
            Coordonnées bancaires
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[2fr_1fr]">
          <div className="space-y-1.5">
            <Label className="text-xs">IBAN</Label>
            <Input
              value={form.iban}
              onChange={(e) => update("iban", e.target.value.toUpperCase())}
              placeholder="BE00 0000 0000 0000"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">BIC (optionnel)</Label>
            <Input value={form.bic} onChange={(e) => update("bic", e.target.value.toUpperCase())} />
          </div>
        </CardContent>
      </Card>

      {/* Pro */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Briefcase className="w-4 h-4" />
            Situation professionnelle
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Employeur</Label>
            <Input value={form.employer} onChange={(e) => update("employer", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">N° BCE employeur</Label>
            <Input
              value={form.employerBce}
              onChange={(e) => update("employerBce", e.target.value)}
              placeholder="0123.456.789"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fonction</Label>
            <Input value={form.jobTitle} onChange={(e) => update("jobTitle", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Type de contrat</Label>
            <Select
              value={form.contractType || "__none__"}
              onValueChange={(v) => update("contractType", v === "__none__" ? "" : v)}
            >
              <SelectTrigger>
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
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Date d&apos;entrée en service</Label>
            <Input
              type="date"
              value={form.contractStart}
              onChange={(e) => update("contractStart", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Suppression */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Zone dangereuse</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Supprimer toutes les données de votre profil. Vos formulaires précédemment générés ne
            sont pas affectés.
          </p>
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="outline" className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Effacer mon profil
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Effacer toutes les données ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. Vos préférences de pré-remplissage seront perdues.
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
