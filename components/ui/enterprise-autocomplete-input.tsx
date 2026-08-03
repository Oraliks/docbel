"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { EnterpriseSuggestion } from "@/lib/pdf-forms/enterprise-suggestions";

const DEBOUNCE_MS = 300;
const MIN_CHARS = 3;
const MAX_SUGGESTIONS = 8;

interface EnterpriseAutocompleteInputProps
  extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  /// Appelé en plus de `onChange` quand l'utilisateur choisit une suggestion
  /// — permet au formulaire d'auto-remplir l'adresse à partir du choix.
  onSelectSuggestion?: (suggestion: EnterpriseSuggestion) => void;
}

/// Autocomplete d'entreprise belge, source mirroir KBO local via l'API
/// publique dédiée `/api/lookup/entreprise` — aucune dépendance externe,
/// aucun appel réseau tiers. Champ TEXTE normal en repli si l'API échoue ou
/// si l'entreprise n'est pas dans le mirroir (indépendant récent, structure
/// étrangère…) : aucun forçage de liste, contrairement aux rues — la
/// suggestion aide, elle n'impose rien.
export function EnterpriseAutocompleteInput({
  value,
  onChange,
  onSelectSuggestion,
  className,
  ...props
}: EnterpriseAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<EnterpriseSuggestion[]>([]);
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
      fetch(`/api/lookup/entreprise?q=${encodeURIComponent(value.trim())}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          // Ignore une réponse arrivée en retard (l'utilisateur a retapé depuis).
          if (seq !== requestSeq.current || !data?.results) return;
          setSuggestions((data.results as EnterpriseSuggestion[]).slice(0, MAX_SUGGESTIONS));
        })
        .catch(() => {
          if (seq === requestSeq.current) setSuggestions([]);
        });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  return (
    <div className={cn("relative", className)}>
      <Input
        {...props}
        value={value}
        className="w-full"
        onChange={(e) => {
          onChange(e.target.value);
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
          // Fond opaque (≥95%) comme la liste de rues : reste lisible
          // au-dessus d'inputs déjà remplis, compatible dark via light-dark().
          style={{
            backgroundColor: "light-dark(rgba(255,255,255,0.97), rgba(24,24,32,0.97))",
          }}
        >
          {suggestions.map((s) => (
            <li key={s.bceNumber}>
              <button
                type="button"
                className="flex w-full flex-col gap-0.5 rounded-xl px-3 py-2 text-left text-sm hover:bg-[color:var(--glass-pop-bg)]"
                onMouseDown={(e) => {
                  // onMouseDown (avant le blur) pour que le clic ne soit pas
                  // annulé par la fermeture du dropdown au blur de l'input.
                  e.preventDefault();
                  onChange(s.name);
                  onSelectSuggestion?.(s);
                  setOpen(false);
                }}
              >
                <span className="font-medium text-[color:var(--glass-ink)]">{s.name}</span>
                {s.address ? (
                  <span className="text-xs text-[color:var(--glass-ink-soft)]">{s.address}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
