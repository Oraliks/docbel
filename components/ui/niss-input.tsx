"use client";

import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";

/** YYMMDD-SSS.CC */
function formatNiss(digits: string): string {
  const d = digits.slice(0, 11);
  if (d.length <= 6) return d;
  if (d.length <= 9) return `${d.slice(0, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 6)}-${d.slice(6, 9)}.${d.slice(9)}`;
}

/** Strip separators — use before passing to isValidNISS or an API. */
export function stripNissFormatting(value: string): string {
  return value.replace(/[^0-9]/g, "").slice(0, 11);
}

interface NissInputProps
  extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Masked input for Belgian NISS numbers.
 * - Only digits are accepted; spaces and other characters are silently dropped.
 * - Auto-inserts the `-` separator after 6 digits and `.` after 9 digits.
 * - Always emits a formatted string (YYMMDD-SSS.CC).
 * - isValidNISS() already strips formatting, so no extra prep is needed
 *   before validation or API submission.
 */
export function NissInput({ value, onChange, ...props }: NissInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const pendingCursor = useRef<number | null>(null);

  // Apply deferred cursor position after React re-renders the controlled value.
  useEffect(() => {
    if (pendingCursor.current !== null && ref.current) {
      ref.current.setSelectionRange(pendingCursor.current, pendingCursor.current);
      pendingCursor.current = null;
    }
  });

  // Backspace right after a separator would re-insert it and do nothing visible.
  // Intercept that case and delete the digit that precedes the separator instead.
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Backspace") return;
    const el = e.currentTarget;
    const start = el.selectionStart;
    if (start === null || start !== el.selectionEnd) return; // active selection: browser handles
    const val = el.value;
    if ((start === 7 && val[6] === "-") || (start === 11 && val[10] === ".")) {
      e.preventDefault();
      // Remove the digit at (start − 2); keep the separator but reformatting will re-add it.
      const next = val.slice(0, start - 2) + val.slice(start - 1);
      const formatted = formatNiss(next.replace(/[^0-9]/g, ""));
      pendingCursor.current = start - 2;
      onChange(formatted);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const cursorPos = e.target.selectionStart ?? raw.length;

    const digits = raw.replace(/[^0-9]/g, "").slice(0, 11);
    const formatted = formatNiss(digits);

    // Map old cursor position (in raw string) → new cursor position (in formatted string).
    const digitsBeforeCursor = raw.slice(0, cursorPos).replace(/[^0-9]/g, "").length;
    let newCursor = formatted.length;
    let seen = 0;
    for (let i = 0; i < formatted.length; i++) {
      if (seen === digitsBeforeCursor) {
        newCursor = i;
        break;
      }
      if (/[0-9]/.test(formatted[i])) seen++;
    }

    pendingCursor.current = newCursor;
    onChange(formatted);
  }

  // Accept raw digits or formatted string as incoming value (normalize for display).
  const displayValue = formatNiss(value.replace(/[^0-9]/g, ""));

  return (
    <Input
      ref={ref}
      value={displayValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      inputMode="numeric"
      placeholder="AAMMJJ-SSS.CC"
      maxLength={13}
      {...props}
    />
  );
}
