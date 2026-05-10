"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Plus, Trash2, Copy, Wand2 } from "lucide-react";
import { dayLabelFr } from "@/lib/bureaus/types";

type Slot = { open: string; close: string };
type Day = { day: number; slots: Slot[] };

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const PRESETS: Array<{ label: string; build: () => Day[] }> = [
  {
    label: "Bureau standard (Lu-Ve 9h-12h / 13h-16h)",
    build: () =>
      [1, 2, 3, 4, 5].map((d) => ({
        day: d,
        slots: [
          { open: "09:00", close: "12:00" },
          { open: "13:00", close: "16:00" },
        ],
      })).concat([
        { day: 0, slots: [] },
        { day: 6, slots: [] },
      ]),
  },
  {
    label: "Standard avec fermeture mer/ven aprem",
    build: () => [
      { day: 1, slots: [{ open: "08:30", close: "12:00" }, { open: "13:00", close: "16:00" }] },
      { day: 2, slots: [{ open: "08:30", close: "12:00" }, { open: "13:00", close: "16:00" }] },
      { day: 3, slots: [{ open: "08:30", close: "12:00" }] },
      { day: 4, slots: [{ open: "08:30", close: "12:00" }, { open: "13:00", close: "16:00" }] },
      { day: 5, slots: [{ open: "08:30", close: "12:00" }] },
      { day: 0, slots: [] },
      { day: 6, slots: [] },
    ],
  },
  {
    label: "Permanence : Lu/Me/Ve matin uniquement",
    build: () => [
      { day: 1, slots: [{ open: "09:00", close: "12:00" }] },
      { day: 2, slots: [] },
      { day: 3, slots: [{ open: "09:00", close: "12:00" }] },
      { day: 4, slots: [] },
      { day: 5, slots: [{ open: "09:00", close: "12:00" }] },
      { day: 0, slots: [] },
      { day: 6, slots: [] },
    ],
  },
  {
    label: "Continue Lu-Ve 8h30-17h",
    build: () =>
      [1, 2, 3, 4, 5].map((d) => ({
        day: d,
        slots: [{ open: "08:30", close: "17:00" }],
      })).concat([
        { day: 0, slots: [] },
        { day: 6, slots: [] },
      ]),
  },
  {
    label: "Tout effacer (fermé tous les jours)",
    build: () => DAY_ORDER.map((d) => ({ day: d, slots: [] })),
  },
];

export function HoursEditor({
  value,
  onChange,
}: {
  value: Day[];
  onChange: (next: Day[]) => void;
}) {
  function update(day: number, slots: Slot[]) {
    const next = value.map((d) => (d.day === day ? { day, slots } : d));
    if (!next.find((d) => d.day === day)) next.push({ day, slots });
    onChange(next);
  }

  function addSlot(day: number) {
    const cur = value.find((d) => d.day === day)?.slots ?? [];
    update(day, [...cur, { open: "09:00", close: "12:00" }]);
  }

  function removeSlot(day: number, idx: number) {
    const cur = value.find((d) => d.day === day)?.slots ?? [];
    update(
      day,
      cur.filter((_, i) => i !== idx)
    );
  }

  function setSlot(day: number, idx: number, patch: Partial<Slot>) {
    const cur = value.find((d) => d.day === day)?.slots ?? [];
    const next = cur.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    update(day, next);
  }

  function copyDayToWeekdays(sourceDay: number) {
    const cur = value.find((d) => d.day === sourceDay)?.slots ?? [];
    const next = value.map((d) => {
      // Copie sur Lu-Ve uniquement (1-5)
      if ([1, 2, 3, 4, 5].includes(d.day)) {
        return { day: d.day, slots: cur.map((s) => ({ ...s })) };
      }
      return d;
    });
    onChange(next);
  }

  function copyDayToAll(sourceDay: number) {
    const cur = value.find((d) => d.day === sourceDay)?.slots ?? [];
    onChange(DAY_ORDER.map((d) => ({ day: d, slots: cur.map((s) => ({ ...s })) })));
  }

  function applyPreset(preset: () => Day[]) {
    onChange(preset());
  }

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button type="button" variant="outline" size="sm">
                <Wand2 className="mr-2 h-3.5 w-3.5" /> Modèles d&apos;horaires
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-72">
            {PRESETS.map((p, i) => (
              <DropdownMenuItem key={i} onClick={() => applyPreset(p.build)}>
                {p.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {DAY_ORDER.map((d) => {
        const slots = value.find((x) => x.day === d)?.slots ?? [];
        return (
          <div key={d} className="grid grid-cols-[60px_1fr_auto] items-start gap-2">
            <div className="text-sm font-medium pt-2">{dayLabelFr(d)}</div>
            <div className="flex flex-col gap-1">
              {slots.length === 0 && (
                <div className="text-xs text-muted-foreground py-2">Fermé</div>
              )}
              {slots.map((s, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Input
                    type="time"
                    value={s.open}
                    onChange={(e) => setSlot(d, i, { open: e.target.value })}
                    className="h-8 w-28"
                  />
                  <span className="text-muted-foreground text-xs">→</span>
                  <Input
                    type="time"
                    value={s.close}
                    onChange={(e) => setSlot(d, i, { close: e.target.value })}
                    className="h-8 w-28"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSlot(d, i)}
                    className="h-7 w-7"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => addSlot(d)}
                className="h-8"
                title="Ajouter une plage"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              {slots.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Copier ces horaires"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => copyDayToWeekdays(d)}>
                      Copier sur Lu→Ve
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => copyDayToAll(d)}>
                      Copier sur tous les jours
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {DAY_ORDER.filter((x) => x !== d).map((target) => (
                      <DropdownMenuItem
                        key={target}
                        onClick={() => {
                          const cur = slots.map((s) => ({ ...s }));
                          update(target, cur);
                        }}
                      >
                        Copier sur {dayLabelFr(target)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
