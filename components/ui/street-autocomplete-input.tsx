"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  parseStreetSuggestions,
  prioritizeByPostalCode,
  type StreetSuggestion,
} from "@/lib/pdf-forms/street-suggestions";

const DEBOUNCE_MS = 300;
const MIN_CHARS = 3;
const MAX_SUGGESTIONS = 8;

interface StreetAutocompleteInputProps
  extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  /// Code postal déjà saisi ailleurs dans le formulaire (optionnel) — les
  /// suggestions dont le code postal correspond remontent en tête, sans
  /// jamais masquer les autres (cf. lib/pdf-forms/street-suggestions.ts).
  postalCode?: string;
  /// Appelé en plus de `onChange` quand l'utilisateur choisit une suggestion
  /// — permet au formulaire d'auto-remplir le code postal à partir du choix.
  onSelectSuggestion?: (suggestion: StreetSuggestion) => void;
  /// Notifie l'état de « vérification » de la rue : `true` quand l'utilisateur
  /// a CHOISI une suggestion (rue réelle BeStAddress), `false` dès qu'il tape
  /// librement. Sert au forçage `requireListMatch` (cf. lib/pdf-forms/
  /// list-match.ts). Ignoré si absent.
  onVerifiedChange?: (verified: boolean) => void;
}

/// Autocomplete de rue belge, source BeStAddress (BOSA, ~144k rues) via
/// l'API publique existante `/api/lookup/search?tableSlug=code-rue` —
/// aucune dépendance externe, aucun appel réseau tiers. Champ TEXTE normal
/// en repli si l'API échoue (l'utilisateur peut toujours taper librement).
export function StreetAutocompleteInput({
  value,
  onChange,
  postalCode,
  onSelectSuggestion,
  onVerifiedChange,
  ...props
}: StreetAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<StreetSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < MIN_CHARS) {
      setSuggestions([]);
      return;
    }
    const seq = ++requestSeq.current;
    debounceRef.current = setTimeout(() => {
      fetch(`/api/lookup/search?q=${encodeURIComponent(value.trim())}&tableSlug=code-rue&limit=20`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          // Ignore une réponse arrivée en retard (l'utilisateur a retapé depuis).
          if (seq !== requestSeq.current || !data?.results) return;
          const parsed = parseStreetSuggestions(data.results);
          setSuggestions(prioritizeByPostalCode(parsed, postalCode).slice(0, MAX_SUGGESTIONS));
        })
        .catch(() => {
          if (seq === requestSeq.current) setSuggestions([]);
        });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, postalCode]);

  return (
    <div className="relative">
      <Input
        {...props}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          // Frappe libre → la rue n'est (plus) vérifiée.
          onVerifiedChange?.(false);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Délai avant fermeture pour laisser le clic sur une suggestion aboutir.
        onBlur={(e) => {
          props.onBlur?.(e);
          setTimeout(() => setOpen(false), 150);
        }}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-autocomplete="list"
      />
      {open && suggestions.length > 0 && (
        <ul
          className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-2xl border border-[color:var(--glass-border)] p-1.5 shadow-xl backdrop-blur-md"
          // Fond volontairement OPAQUE (≥ 95 %) et non pas la variable
          // `--glass-surface-strong` (62 %) : la liste de rues doit rester
          // lisible même par-dessus des inputs déjà remplis, indépendamment
          // du thème global (Oraliks 2026-07-07 : « affichage un peu trop
          // transparent, on voit pas bien »). Compatible dark grâce au
          // `light-dark()` — on ne réutilise pas de variable glass ici pour
          // ne pas la contraindre à devenir opaque partout ailleurs.
          style={{
            backgroundColor: "light-dark(rgba(255,255,255,0.97), rgba(24,24,32,0.97))",
          }}
        >
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="flex w-full flex-col gap-0.5 rounded-xl px-3 py-2 text-left text-sm hover:bg-[color:var(--glass-pop-bg)]"
                onMouseDown={(e) => {
                  // onMouseDown (avant le blur) pour que le clic ne soit pas
                  // annulé par la fermeture du dropdown au blur de l'input.
                  e.preventDefault();
                  onChange(s.street);
                  onSelectSuggestion?.(s);
                  // Sélection dans la liste → rue vérifiée (existe en base).
                  onVerifiedChange?.(true);
                  setOpen(false);
                }}
              >
                <span className="font-medium text-[color:var(--glass-ink)]">{s.street}</span>
                <span className="text-xs text-[color:var(--glass-ink-soft)]">
                  {s.postalCode} {s.commune}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
