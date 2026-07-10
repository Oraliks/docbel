"use client";

import { useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import { fr } from "react-day-picker/locale";
import "react-day-picker/style.css";
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerInputProps {
  id?: string;
  /// Date au format ISO `YYYY-MM-DD` (ou "" si vide).
  value: string;
  onChange: (iso: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  /// Désactive samedi + dimanche dans le calendrier (dates d'introduction /
  /// d'effet d'un dossier, cf. #7b).
  noWeekend?: boolean;
  className?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
/// ISO `YYYY-MM-DD` → Date locale (midi local pour éviter tout glissement de
/// jour aux changements d'heure). Chaîne invalide → undefined.
function isoToDate(iso: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}
function dateToISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/// Affichage FR : JJ/MM/AAAA.
function formatFR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/// Sélecteur de date moderne (calendrier popover, react-day-picker) remplaçant
/// l'input date natif. Thème glass, locale FR, semaine commençant le lundi.
export function DatePickerInput({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  invalid,
  disabled,
  noWeekend,
  className,
}: DatePickerInputProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => isoToDate(value), [value]);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) onBlur?.();
      }}
    >
      <PopoverTrigger
        id={id}
        type="button"
        disabled={disabled}
        aria-invalid={invalid}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-md border bg-transparent px-3 text-sm shadow-xs transition-colors",
          "border-input hover:bg-[color:var(--glass-pop-bg)]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          invalid && "border-destructive ring-destructive/20",
          disabled && "cursor-not-allowed opacity-60",
          className,
        )}
      >
        <CalendarIcon className="size-4 shrink-0 opacity-70" />
        <span className={cn("flex-1 text-left", !value && "text-muted-foreground")}>
          {value ? formatFR(value) : placeholder || "JJ/MM/AAAA"}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <DayPicker
          mode="single"
          locale={fr}
          weekStartsOn={1}
          captionLayout="dropdown"
          startMonth={new Date(1920, 0)}
          endMonth={new Date(new Date().getFullYear() + 5, 11)}
          selected={selected}
          defaultMonth={selected}
          disabled={noWeekend ? { dayOfWeek: [0, 6] } : undefined}
          onSelect={(d) => {
            if (d) {
              onChange(dateToISO(d));
              setOpen(false);
              onBlur?.();
            }
          }}
          styles={{
            root: { margin: 0 },
          }}
          modifiersClassNames={{
            selected: "!bg-[color:var(--glass-accent-deep,#7c3aed)] !text-white",
            today: "font-bold text-[color:var(--glass-accent-deep,#7c3aed)]",
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
