"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { searchCountries, findCountryByName, flagEmoji, type WorldCountry } from "@/lib/pdf-forms/world-countries";

const MAX_SUGGESTIONS = 8;

interface CountrySelectInputProps
  extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
}

/// Champ "pays" avec recherche locale (~195 pays, aucun appel réseau — cf.
/// lib/pdf-forms/world-countries.ts) et drapeau affiché en préfixe une fois
/// une correspondance exacte trouvée. Même mécanique d'interaction que
/// StreetAutocompleteInput (liste sous l'input, sélection au clic), sans le
/// debounce/fetch : le filtrage est synchrone.
export function CountrySelectInput({ value, onChange, ...props }: CountrySelectInputProps) {
  const [open, setOpen] = useState(false);
  const suggestions = open ? searchCountries(value, MAX_SUGGESTIONS) : [];
  const currentFlag = flagEmoji(findCountryByName(value)?.code ?? "");

  const selectCountry = (country: WorldCountry) => {
    onChange(country.name);
    setOpen(false);
  };

  return (
    <div className="relative">
      {currentFlag && (
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-base leading-none">
          {currentFlag}
        </span>
      )}
      <Input
        {...props}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Délai avant fermeture pour laisser le clic sur une suggestion aboutir
        // (même technique que StreetAutocompleteInput).
        onBlur={(e) => {
          props.onBlur?.(e);
          setTimeout(() => setOpen(false), 150);
        }}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-autocomplete="list"
        className={currentFlag ? `pl-8 ${props.className ?? ""}` : props.className}
      />
      {open && suggestions.length > 0 && (
        <ul
          className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-2xl border border-[color:var(--glass-border)] p-1.5 shadow-xl backdrop-blur-md"
          style={{
            backgroundColor: "light-dark(rgba(255,255,255,0.97), rgba(24,24,32,0.97))",
          }}
        >
          {suggestions.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-[color:var(--glass-pop-bg)]"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectCountry(c);
                }}
              >
                <span className="text-base leading-none">{flagEmoji(c.code)}</span>
                <span className="text-[color:var(--glass-ink)]">{c.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
