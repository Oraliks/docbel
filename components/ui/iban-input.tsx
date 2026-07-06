"use client";

import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";

const MAX_CHARS = 34; // longueur IBAN maximale (Malte, ISO 13616).

/// Formate en groupes de 4 (ex. "BE68 5390 0754 7034"), majuscules, sans
/// séparateurs internes autres que l'espace.
function formatIban(raw: string): string {
  const clean = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, MAX_CHARS);
  return clean.replace(/(.{4})/g, "$1 ").trim();
}

interface IbanInputProps
  extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
}

/// Champ IBAN masqué (groupes de 4, majuscules). Accepte tout IBAN
/// (belge ou étranger) — la validation elle-même (belge stricte ou
/// internationale) se fait ailleurs selon `field.internationalIban`.
export function IbanInput({ value, onChange, ...props }: IbanInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const pendingCursor = useRef<number | null>(null);

  useEffect(() => {
    if (pendingCursor.current !== null && ref.current) {
      ref.current.setSelectionRange(pendingCursor.current, pendingCursor.current);
      pendingCursor.current = null;
    }
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const cursorPos = e.target.selectionStart ?? raw.length;
    const formatted = formatIban(raw);

    // Map ancienne position de curseur (chars significatifs avant le curseur) → nouvelle.
    const meaningfulBeforeCursor = raw.slice(0, cursorPos).replace(/[^A-Za-z0-9]/g, "").length;
    let newCursor = formatted.length;
    let seen = 0;
    for (let i = 0; i < formatted.length; i++) {
      if (seen === meaningfulBeforeCursor) {
        newCursor = i;
        break;
      }
      if (/[A-Z0-9]/.test(formatted[i])) seen++;
    }

    pendingCursor.current = newCursor;
    onChange(formatted);
  }

  const displayValue = formatIban(value);

  return (
    <Input
      ref={ref}
      value={displayValue}
      onChange={handleChange}
      inputMode="text"
      autoComplete="off"
      spellCheck={false}
      {...props}
    />
  );
}
