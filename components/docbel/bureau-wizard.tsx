"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowRight, ArrowLeft, Sparkles, CheckCircle2 } from "lucide-react";
import type { ResolveResult } from "@/lib/bureaus/resolve";
import type { SerializedBureau } from "@/lib/bureaus/types";
import { BureauCard } from "./bureau-card";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accent: string;
  initialPostalCode?: string;
  initialOrganismePaiement?: string | null;
  initialCommissionCode?: string | null;
};

type Need =
  | "ris" // CPAS — aide sociale
  | "chomage_inscription" // ONEM + paiement
  | "chomage_carte" // org. de paiement
  | "commune_admin" // état civil
  | "syndicat_sectoriel"; // syndicat sectoriel

const NEEDS = [
  { value: "ris", emoji: "🏠", label: "Aide sociale / RIS", helper: "Revenu d'intégration sociale" },
  { value: "chomage_inscription", emoji: "📋", label: "M'inscrire au chômage", helper: "Première démarche" },
  { value: "chomage_carte", emoji: "🃏", label: "Déposer ma carte C", helper: "Contrôle / paiement allocations" },
  { value: "commune_admin", emoji: "🏛️", label: "Démarche communale", helper: "État civil, urbanisme, etc." },
  { value: "syndicat_sectoriel", emoji: "🛠️", label: "Question sur mon contrat", helper: "Syndicat sectoriel" },
] as const;

const ORGS = [
  { value: "capac", label: "CAPAC (caisse publique)", helper: "Si vous n'êtes pas syndiqué" },
  { value: "fgtb", label: "FGTB / ABVV", helper: "Syndicat socialiste" },
  { value: "csc", label: "CSC / ACV", helper: "Syndicat chrétien" },
  { value: "cgslb", label: "CGSLB / ACLVB", helper: "Syndicat libéral" },
];

export function WizardDialog({
  open,
  onOpenChange,
  accent,
  initialPostalCode = "",
  initialOrganismePaiement = null,
  initialCommissionCode = null,
}: Props) {
  const [step, setStep] = useState(0);
  const [cp, setCp] = useState(initialPostalCode);
  const [need, setNeed] = useState<Need | null>(null);
  const [org, setOrg] = useState<string | null>(initialOrganismePaiement);
  const [cpSecteur, setCpSecteur] = useState<string | null>(initialCommissionCode);
  const [data, setData] = useState<ResolveResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [savePref, setSavePref] = useState(true);

  useEffect(() => {
    if (open) {
      setStep(0);
      setCp(initialPostalCode);
      setNeed(null);
      setOrg(initialOrganismePaiement);
      setCpSecteur(initialCommissionCode);
      setData(null);
    }
  }, [open, initialPostalCode, initialOrganismePaiement, initialCommissionCode]);

  // Quelle question selon le need ?
  const askOrg = need === "chomage_carte" || need === "chomage_inscription";
  const askCpSecteur = need === "syndicat_sectoriel";

  const totalSteps = 2 + (askOrg ? 1 : 0) + (askCpSecteur ? 1 : 0);

  async function resolveAndShow() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ cp });
      if (org) params.set("org", org);
      if (cpSecteur) params.set("commission", cpSecteur);
      const r = await fetch(`/api/bureaux/resolve?${params}`);
      if (!r.ok) throw new Error("Erreur réseau");
      const j: ResolveResult = await r.json();
      setData(j);
      setStep(totalSteps); // page résultats

      // Sauvegarde dans le profil (si user connecté + savePref)
      if (savePref && (org || cpSecteur)) {
        fetch("/api/user/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organismePaiement: org,
            commissionParitaireCode: cpSecteur,
            postalCode: cp,
          }),
        }).catch(() => {});
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  function canAdvance(): boolean {
    if (step === 0) return /^\d{4}$/.test(cp.trim());
    if (step === 1) return !!need;
    if (step === 2 && askOrg) return !!org;
    if (step === 2 && askCpSecteur) return !!cpSecteur && /^\d+/.test(cpSecteur);
    if (step === 3 && askOrg && askCpSecteur) return true; // last
    return true;
  }

  function next() {
    if (step < totalSteps - 1) setStep(step + 1);
    else void resolveAndShow();
  }

  function prev() {
    if (step > 0) setStep(step - 1);
  }

  // Calcule le bureau à montrer selon le need
  const bureau: SerializedBureau | null = (() => {
    if (!data) return null;
    if (need === "ris") return data.attitre.cpas;
    if (need === "commune_admin") return data.attitre.commune;
    if (need === "chomage_inscription") return data.attitre.onem;
    if (need === "chomage_carte") return data.attitre.organismePaiement ?? data.attitre.onem;
    if (need === "syndicat_sectoriel") return data.sectoriel.commissionRelated[0] ?? null;
    return null;
  })();

  const showingResults = step === totalSteps;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" style={{ color: accent }} />
            {showingResults ? "Votre bureau attitré" : "Aide-moi à trouver mon bureau"}
          </DialogTitle>
          {!showingResults && (
            <DialogDescription>
              {totalSteps > 0 && `Étape ${step + 1} sur ${totalSteps} · `}
              Quelques questions pour vous orienter directement au bon endroit.
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Progress bar */}
        {!showingResults && (
          <div className="flex gap-1 mb-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className="flex-1 h-1 rounded-full transition-colors"
                style={{
                  backgroundColor: i <= step ? accent : "var(--border)",
                }}
              />
            ))}
          </div>
        )}

        <div className="min-h-[200px]">
          {/* Étape 1 : code postal */}
          {step === 0 && (
            <div className="space-y-3">
              <label className="text-sm font-semibold">Où habitez-vous ?</label>
              <Input
                value={cp}
                onChange={(e) => setCp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="Code postal (4 chiffres)"
                inputMode="numeric"
                className="text-lg font-semibold h-12"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                On en a besoin pour trouver le bureau compétent pour votre commune.
              </p>
            </div>
          )}

          {/* Étape 2 : need */}
          {step === 1 && (
            <div className="space-y-3">
              <label className="text-sm font-semibold">De quoi avez-vous besoin ?</label>
              <div className="flex flex-col gap-2">
                {NEEDS.map((n) => (
                  <button
                    key={n.value}
                    type="button"
                    onClick={() => setNeed(n.value as Need)}
                    className={`text-left p-3 rounded-lg border-[1.5px] transition-all flex items-center gap-3 hover:bg-accent/30 ${
                      need === n.value ? "shadow-sm" : ""
                    }`}
                    style={{ borderColor: need === n.value ? accent : "var(--border)" }}
                  >
                    <span className="text-2xl">{n.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{n.label}</div>
                      <div className="text-xs text-muted-foreground">{n.helper}</div>
                    </div>
                    {need === n.value && (
                      <CheckCircle2 size={16} style={{ color: accent }} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Étape 3a : organisme de paiement */}
          {step === 2 && askOrg && (
            <div className="space-y-3">
              <label className="text-sm font-semibold">Êtes-vous syndiqué ?</label>
              <div className="flex flex-col gap-2">
                {ORGS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setOrg(o.value)}
                    className={`text-left p-3 rounded-lg border-[1.5px] transition-all hover:bg-accent/30`}
                    style={{ borderColor: org === o.value ? accent : "var(--border)" }}
                  >
                    <div className="font-semibold text-sm">{o.label}</div>
                    <div className="text-xs text-muted-foreground">{o.helper}</div>
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                <input
                  type="checkbox"
                  checked={savePref}
                  onChange={(e) => setSavePref(e.target.checked)}
                />
                Mémoriser dans mon profil (pour la prochaine fois)
              </label>
            </div>
          )}

          {/* Étape 3b : commission paritaire */}
          {step === 2 && askCpSecteur && (
            <div className="space-y-3">
              <label className="text-sm font-semibold">Votre commission paritaire ?</label>
              <Input
                value={cpSecteur ?? ""}
                onChange={(e) => setCpSecteur(e.target.value.replace(/\D/g, ""))}
                placeholder="ex : 124 (construction), 200 (employés)…"
                inputMode="numeric"
                className="h-11"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Numéro à 3 chiffres présent sur votre fiche de paie. Si vous ne le connaissez pas,
                passez cette étape.
              </p>
            </div>
          )}

          {/* Résultats */}
          {showingResults && (
            <div className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Recherche...
                </div>
              ) : bureau ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Voici le bureau attitré pour votre situation :
                  </p>
                  <BureauCard bureau={bureau} accent={accent} variant="attitre" enableReport={false} />
                  {data?.commune && (
                    <p className="text-[11px] text-muted-foreground text-center pt-2">
                      Compétent pour {data.commune.nameFr} ({cp})
                    </p>
                  )}
                </>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  Aucun bureau n&apos;a été trouvé pour cette combinaison. Essayez la recherche libre
                  ou contactez-nous.
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {showingResults ? (
            <>
              <Button variant="outline" onClick={() => setStep(0)}>
                Recommencer
              </Button>
              <Button onClick={() => onOpenChange(false)} style={{ backgroundColor: accent }}>
                Fermer
              </Button>
            </>
          ) : (
            <>
              {step > 0 && (
                <Button variant="outline" onClick={prev}>
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Retour
                </Button>
              )}
              <Button onClick={next} disabled={!canAdvance() || loading} style={{ backgroundColor: accent }}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {step === totalSteps - 1 ? (
                  <>
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    Trouver mon bureau
                  </>
                ) : (
                  <>
                    Suivant <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
