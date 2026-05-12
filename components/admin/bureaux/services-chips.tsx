"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SERVICE_CODES } from "@/lib/bureaus/types";

const SERVICE_LABELS: Record<string, string> = {
  RIS: "RIS",
  aide_juridique: "Aide juridique",
  aide_alimentaire: "Aide alimentaire",
  domiciliation: "Domiciliation",
  energie: "Énergie",
  logement: "Logement",
  etat_civil: "État civil",
  population: "Population",
  urbanisme: "Urbanisme",
  chomage: "Chômage",
  controle: "Contrôle ONEM",
  permanence_sociale: "Permanence sociale",
  rdv_obligatoire: "RDV obligatoire",
};

export function ServicesChips({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [custom, setCustom] = useState("");

  function toggle(code: string) {
    if (value.includes(code)) onChange(value.filter((v) => v !== code));
    else onChange([...value, code]);
  }

  function addCustom() {
    const c = custom.trim().toLowerCase().replace(/\s+/g, "_");
    if (!c || value.includes(c)) return;
    onChange([...value, c]);
    setCustom("");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {SERVICE_CODES.map((code) => {
          const active = value.includes(code);
          return (
            <Badge
              key={code}
              variant={active ? "default" : "outline"}
              className="cursor-pointer select-none"
              onClick={() => toggle(code)}
            >
              {SERVICE_LABELS[code] ?? code}
            </Badge>
          );
        })}
      </div>
      {value.filter((v) => !SERVICE_CODES.includes(v as typeof SERVICE_CODES[number])).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value
            .filter((v) => !SERVICE_CODES.includes(v as typeof SERVICE_CODES[number]))
            .map((v) => (
              <Badge key={v} variant="default" className="gap-1">
                {v}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((x) => x !== v))}
                  className="opacity-70 hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
        </div>
      )}
      <div className="flex gap-1">
        <Input
          placeholder="Ajouter un service personnalisé..."
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          className="h-8"
        />
        <Button type="button" variant="outline" size="sm" onClick={addCustom}>
          Ajouter
        </Button>
      </div>
    </div>
  );
}
