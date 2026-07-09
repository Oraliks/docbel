"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

interface CommuneSelectInputProps
  extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  /// Code postal courant (champ désigné par `communeFrom.postalFieldId`).
  postalCode?: string;
}

/// Champ commune résolu depuis le code postal via `/api/postal-lookup`
/// (données Commune/PostalCode en base, zéro dépendance tierce) :
///   - 1 commune  → champ VERROUILLÉ auto-rempli (cas quasi général en BE) ;
///   - plusieurs  → menu déroulant des communes du code (rares fusions) ;
///   - aucune     → texte libre (code postal étranger / inconnu).
/// Même esprit que le champ « pays » dérivé du code postal, mais la
/// résolution est asynchrone (lookup base) donc portée par un composant plutôt
/// que par `derivedFrom` (synchrone). L'auto-remplissage écrit la valeur dans
/// le payload → elle est stampée sur le PDF (cf. `drawAt`).
export function CommuneSelectInput({ value, onChange, postalCode, ...props }: CommuneSelectInputProps) {
  const [communes, setCommunes] = useState<string[]>([]);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;
  const seq = useRef(0);

  useEffect(() => {
    const code = (postalCode ?? "").trim();
    if (!/^\d{4}$/.test(code)) {
      setCommunes([]);
      return;
    }
    const s = ++seq.current;
    fetch(`/api/postal-lookup?code=${code}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (s !== seq.current) return;
        const list: string[] = (data?.communes ?? [])
          .map((c: { nameFr: string }) => c.nameFr)
          .filter(Boolean);
        setCommunes(list);
        // Auto-remplissage (async, dans le .then — pas un setState synchrone
        // d'effet) si une seule commune correspond et que la valeur diffère.
        if (list.length === 1 && valueRef.current !== list[0]) onChangeRef.current(list[0]);
      })
      .catch(() => {
        if (s === seq.current) setCommunes([]);
      });
  }, [postalCode]);

  const { id, className, onBlur } = props;
  const invalid = props["aria-invalid"];

  // 1 commune → verrouillé (comme le pays « Belgique »).
  if (communes.length === 1) {
    return (
      <Input
        {...props}
        value={communes[0]}
        readOnly
        disabled
        className={`flex-1 ${className ?? ""}`}
      />
    );
  }

  // Plusieurs communes → menu déroulant (natif : robuste, évite la sentinelle
  // base-ui Select ; cas rare, styling aligné sur l'input).
  if (communes.length > 1) {
    return (
      <select
        id={id}
        aria-invalid={invalid}
        // `onBlur` (fourni par PdfField = markTouched) ignore l'événement —
        // le double-cast est sûr : on ne lit jamais la cible.
        onBlur={onBlur as unknown as React.FocusEventHandler<HTMLSelectElement>}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
      >
        <option value="" disabled>
          Choisis ta commune…
        </option>
        {communes.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    );
  }

  // Aucune (code étranger / inconnu) → texte libre.
  return (
    <Input {...props} value={value} onChange={(e) => onChange(e.target.value)} className={`flex-1 ${className ?? ""}`} />
  );
}
