"use client";

import { useSyncExternalStore } from "react";

/** Article dénormalisé stocké côté client (épingles / historique). */
export interface RegItem {
  riolexId: string;
  loi: string;
  articleNumber: string;
  title: string;
}

const PINS_KEY = "regl:pins";
const RECENTS_KEY = "regl:recents";
const EVT = "regl:store-changed";
const RECENTS_CAP = 12;

const EMPTY: RegItem[] = [];

// Cache par clé : useSyncExternalStore exige une snapshot stable (même
// référence tant que la valeur ne change pas), sinon boucle de rendu.
const cache: Record<string, { raw: string; val: RegItem[] }> = {};

function read(key: string): RegItem[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(key) ?? "[]";
  const c = cache[key];
  if (c && c.raw === raw) return c.val;
  let val: RegItem[];
  try {
    const parsed = JSON.parse(raw);
    val = Array.isArray(parsed) ? parsed : EMPTY;
  } catch {
    val = EMPTY;
  }
  cache[key] = { raw, val };
  return val;
}

function write(key: string, val: RegItem[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(val));
    window.dispatchEvent(new Event(EVT));
  } catch {
    /* stockage indisponible (mode privé) */
  }
}

export function getPins(): RegItem[] {
  return read(PINS_KEY);
}

export function togglePin(item: RegItem) {
  const pins = getPins();
  const i = pins.findIndex((p) => p.riolexId === item.riolexId);
  const next = i >= 0 ? pins.filter((p) => p.riolexId !== item.riolexId) : [item, ...pins];
  write(PINS_KEY, next);
}

export function getRecents(): RegItem[] {
  return read(RECENTS_KEY);
}

export function pushRecent(item: RegItem) {
  if (!item.riolexId) return;
  const rest = getRecents().filter((x) => x.riolexId !== item.riolexId);
  write(RECENTS_KEY, [item, ...rest].slice(0, RECENTS_CAP));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Hook réactif : re-rend quand les épingles / l'historique changent. */
export function usePins(): RegItem[] {
  return useSyncExternalStore(subscribe, getPins, () => EMPTY);
}

export function useRecents(): RegItem[] {
  return useSyncExternalStore(subscribe, getRecents, () => EMPTY);
}
