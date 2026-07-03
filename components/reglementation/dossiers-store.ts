"use client";

import { useSyncExternalStore } from "react";
import type { RegItem } from "./pins-store";

/**
 * Dossiers de travail : regroupements nommés d'articles, orientés « cas »
 * (au-delà des épingles = favoris rapides). localStorage, par poste. Zéro DB.
 */

export interface Dossier {
  id: string;
  name: string;
  items: RegItem[];
}

const KEY = "regl:dossiers";
const EVT = "regl:store-changed";
const EMPTY: Dossier[] = [];

let cache: { raw: string; val: Dossier[] } | null = null;

function read(): Dossier[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(KEY) ?? "[]";
  if (cache && cache.raw === raw) return cache.val;
  let val: Dossier[];
  try {
    const parsed = JSON.parse(raw);
    val = Array.isArray(parsed) ? parsed : EMPTY;
  } catch {
    val = EMPTY;
  }
  cache = { raw, val };
  return val;
}

function write(list: Dossier[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(EVT));
  } catch {
    /* stockage indisponible */
  }
}

function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID?.() ?? `d${read().length}-${JSON.stringify(read()).length}`;
}

export function getDossiers(): Dossier[] {
  return read();
}

export function createDossier(name: string): string {
  const id = newId();
  write([...read(), { id, name: name.trim() || "Dossier", items: [] }]);
  return id;
}

export function renameDossier(id: string, name: string) {
  write(read().map((d) => (d.id === id ? { ...d, name: name.trim() || d.name } : d)));
}

export function deleteDossier(id: string) {
  write(read().filter((d) => d.id !== id));
}

export function addToDossier(id: string, item: RegItem) {
  write(
    read().map((d) =>
      d.id === id && !d.items.some((i) => i.riolexId === item.riolexId)
        ? { ...d, items: [...d.items, item] }
        : d,
    ),
  );
}

export function removeFromDossier(id: string, riolexId: string) {
  write(
    read().map((d) =>
      d.id === id
        ? { ...d, items: d.items.filter((i) => i.riolexId !== riolexId) }
        : d,
    ),
  );
}

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useDossiers(): Dossier[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
