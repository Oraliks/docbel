"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  /// Libellé accessible du bouton calendrier.
  calendarLabel?: string;
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

/// Insère les barres obliques À MESURE de la frappe : le citoyen tape huit
/// chiffres, la machine place les séparateurs. On ne touche jamais à ce qu'il
/// a écrit au-delà de huit chiffres — le surplus est simplement ignoré, plutôt
/// que d'effacer sa saisie sous ses doigts.
export function masqueDateFR(saisie: string): string {
  const chiffres = saisie.replace(/\D/g, "").slice(0, 8);
  if (chiffres.length <= 2) return chiffres;
  if (chiffres.length <= 4) return `${chiffres.slice(0, 2)}/${chiffres.slice(2)}`;
  return `${chiffres.slice(0, 2)}/${chiffres.slice(2, 4)}/${chiffres.slice(4)}`;
}

/// `JJ/MM/AAAA` → ISO, ou "" si la date n'existe pas.
///
/// Le contrôle de VALIDITÉ compte autant que celui de forme : « 31/02/2026 »
/// est bien formé mais n'existe pas, et `new Date(2026, 1, 31)` le convertit
/// silencieusement en 3 mars. On recompose donc la date et on vérifie qu'elle
/// rend les mêmes jour/mois/année que ceux saisis.
export function frVersISO(texte: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texte.trim());
  if (!m) return "";
  const [j, mo, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
  // Bornes du calendrier : mêmes que celles du sélecteur, pour qu'une date
  // tapée ne puisse pas viser une année que le calendrier refuserait.
  if (a < 1920 || a > new Date().getFullYear() + 5) return "";
  const d = new Date(a, mo - 1, j, 12, 0, 0);
  if (d.getFullYear() !== a || d.getMonth() !== mo - 1 || d.getDate() !== j) return "";
  return dateToISO(d);
}

/// Champ date : SAISIE AU CLAVIER d'abord, calendrier en second.
///
/// Le composant n'était qu'un bouton ouvrant un calendrier (2026-08-02) : son
/// espace réservé annonçait pourtant « JJ/MM/AAAA », ce qui invite à taper. Un
/// citoyen qui connaît sa date — c'est le cas courant, il la lit sur un
/// document — devait naviguer de mois en mois pour la retrouver. Taper huit
/// chiffres est plus rapide, et c'est le seul geste possible au clavier seul.
///
/// Le calendrier reste, sur son propre bouton : il sert quand on cherche « le
/// premier lundi d'octobre » plutôt qu'une date qu'on a sous les yeux.
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
  calendarLabel,
}: DatePickerInputProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => isoToDate(value), [value]);

  // Texte affiché dans le champ. Distinct de `value` : pendant la frappe,
  // « 15/08 » n'est pas encore une date, et remonter "" au parent à chaque
  // touche effacerait le champ sous les doigts du citoyen.
  const [texte, setTexte] = useState(() => formatFR(value));
  // Vrai tant que le citoyen tape : on cesse alors de récrire son champ depuis
  // la valeur du parent, qui vaut "" tant que la saisie est incomplète.
  const enFrappe = useRef(false);

  useEffect(() => {
    if (enFrappe.current) return;
    setTexte(formatFR(value));
  }, [value]);

  const appliquer = (saisie: string) => {
    const masque = masqueDateFR(saisie);
    setTexte(masque);
    const iso = frVersISO(masque);
    // Vide OU complète : dans les deux cas le parent doit savoir. Une saisie
    // partielle ne vaut pas une date — on remonte "" pour que la validation
    // la traite comme absente plutôt que comme une date fausse.
    onChange(iso);
  };

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={texte}
        disabled={disabled}
        aria-invalid={invalid}
        placeholder={placeholder || "JJ/MM/AAAA"}
        maxLength={10}
        onFocus={() => {
          enFrappe.current = true;
        }}
        onChange={(e) => appliquer(e.target.value)}
        onBlur={() => {
          enFrappe.current = false;
          // Saisie incomplète abandonnée : on la remet au propre plutôt que de
          // laisser « 15/0 » dans le champ. Si elle était valide, `formatFR`
          // rend exactement ce que le citoyen a tapé.
          setTexte(formatFR(value));
          onBlur?.();
        }}
        className={cn(
          "h-9 w-full min-w-0 flex-1 rounded-md border bg-transparent px-3 text-sm shadow-xs transition-colors",
          "border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          invalid && "border-destructive ring-destructive/20",
          disabled && "cursor-not-allowed opacity-60",
        )}
      />
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) onBlur?.();
        }}
      >
        <PopoverTrigger
          type="button"
          disabled={disabled}
          aria-label={calendarLabel || "Choisir dans le calendrier"}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md border bg-transparent shadow-xs transition-colors",
            "border-input hover:bg-[color:var(--glass-pop-bg)]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <CalendarIcon className="size-4 opacity-70" />
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
                const iso = dateToISO(d);
                enFrappe.current = false;
                setTexte(formatFR(iso));
                onChange(iso);
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
    </div>
  );
}
