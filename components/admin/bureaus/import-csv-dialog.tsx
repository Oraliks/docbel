"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const SAMPLE = `type;organismeCode;name;street;streetNum;postalCode;city;insCode;phone;email;website;appointmentUrl;lat;lng
CPAS;cpas;CPAS de Wavre;Place de l'Hôtel de Ville;1;1300;Wavre;25072;010 23 03 00;;https://www.cpas-wavre.be;;;
COMMUNE;commune;Maison communale de Wavre;Place de l'Hôtel de Ville;1;1300;Wavre;25072;010 23 03 11;;https://www.wavre.be;;;`;

type Org = { id: string; code: string; name: string };

type PreviewState =
  | { state: "idle" }
  | { state: "previewed"; valid: number; errors: { row: number; message: string }[]; preview: unknown[] }
  | { state: "imported"; created: number; updated: number };

export function ImportCsvDialog({
  open,
  onOpenChange,
  onImported,
  organismes,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: () => void;
  organismes: Org[];
}) {
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewState>({ state: "idle" });

  function reset() {
    setCsv("");
    setPreview({ state: "idle" });
  }

  async function doPreview() {
    if (!csv.trim()) {
      toast.error("Collez le contenu CSV");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/bureaus/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, dryRun: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Échec");
        return;
      }
      setPreview({
        state: "previewed",
        valid: data.valid ?? 0,
        errors: data.errors ?? [],
        preview: data.preview ?? [],
      });
    } catch (err) {
      console.error(err);
      toast.error("Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  async function doImport() {
    if (preview.state !== "previewed") return;
    if (preview.errors.length > 0) {
      toast.error("Corrigez les erreurs avant d'importer");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/bureaus/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, dryRun: false }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? "Échec import");
        return;
      }
      setPreview({ state: "imported", created: data.created, updated: data.updated });
      toast.success(`${data.created} créés, ${data.updated} mis à jour`);
      onImported();
    } catch (err) {
      console.error(err);
      toast.error("Erreur réseau");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importer un CSV de bureaux</DialogTitle>
          <DialogDescription>
            Format : séparateur point-virgule (Excel BE). Colonnes requises&nbsp;:{" "}
            <code>type, organismeCode, name, street, postalCode, city</code>. Optionnelles&nbsp;:{" "}
            <code>streetNum, insCode, phone, email, website, appointmentUrl, lat, lng</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Codes organismes disponibles :{" "}
            <span className="font-mono">
              {organismes.map((o) => o.code).join(", ")}
            </span>
          </div>

          <details>
            <summary className="cursor-pointer text-xs text-muted-foreground">
              Voir un exemple
            </summary>
            <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">{SAMPLE}</pre>
            <Button
              variant="link"
              size="sm"
              type="button"
              onClick={() => setCsv(SAMPLE)}
              className="px-0"
            >
              Charger l'exemple
            </Button>
          </details>

          <Textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={10}
            placeholder="Collez ici le contenu CSV"
            className="font-mono text-xs"
          />

          {preview.state === "previewed" && (
            <div className="rounded border p-3 space-y-2">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="border-green-500 text-green-700">
                  {preview.valid} ligne{preview.valid > 1 ? "s" : ""} valides
                </Badge>
                {preview.errors.length > 0 && (
                  <Badge variant="outline" className="border-red-500 text-red-700">
                    {preview.errors.length} erreur{preview.errors.length > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              {preview.errors.length > 0 && (
                <div className="text-xs space-y-0.5 max-h-40 overflow-y-auto">
                  {preview.errors.slice(0, 20).map((e, i) => (
                    <div key={i} className="flex gap-1 text-red-700">
                      <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                      Ligne {e.row}: {e.message}
                    </div>
                  ))}
                  {preview.errors.length > 20 && (
                    <div className="text-muted-foreground">
                      ... +{preview.errors.length - 20} autres
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {preview.state === "imported" && (
            <div className="rounded border border-green-500 p-3 flex items-center gap-2 text-green-700">
              <Check className="h-4 w-4" />
              {preview.created} créés, {preview.updated} mis à jour
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Fermer
          </Button>
          {preview.state !== "imported" && (
            <>
              <Button variant="outline" onClick={doPreview} disabled={busy || !csv.trim()}>
                {busy && preview.state !== "previewed" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Prévisualiser
              </Button>
              <Button
                onClick={doImport}
                disabled={busy || preview.state !== "previewed" || preview.errors.length > 0}
              >
                {busy && preview.state === "previewed" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Upload className="mr-2 h-4 w-4" />
                Importer
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
