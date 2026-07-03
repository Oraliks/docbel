"use client";

import { useSyncExternalStore } from "react";

/**
 * Notes personnelles par article (localStorage, par poste). Zéro base de données
 * (version cross-device = follow-up). Même mécanique que pins-store
 * (useSyncExternalStore → snapshot stable, aucun setState dans un effet).
 */

const NOTES_KEY = "regl:notes";
const EVT = "regl:store-changed";

type NotesMap = Record<string, string>;
const EMPTY: NotesMap = {};

let cache: { raw: string; val: NotesMap } | null = null;

function read(): NotesMap {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(NOTES_KEY) ?? "{}";
  if (cache && cache.raw === raw) return cache.val;
  let val: NotesMap;
  try {
    const parsed = JSON.parse(raw);
    val = parsed && typeof parsed === "object" ? (parsed as NotesMap) : EMPTY;
  } catch {
    val = EMPTY;
  }
  cache = { raw, val };
  return val;
}

function write(map: NotesMap) {
  try {
    window.localStorage.setItem(NOTES_KEY, JSON.stringify(map));
    window.dispatchEvent(new Event(EVT));
  } catch {
    /* stockage indisponible */
  }
}

export function getNote(riolexId: string): string {
  return read()[riolexId] ?? "";
}

export function setNote(riolexId: string, text: string) {
  const next = { ...read() };
  if (text.trim()) next[riolexId] = text;
  else delete next[riolexId];
  write(next);
}

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useNotes(): NotesMap {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function useNote(riolexId: string): string {
  return useNotes()[riolexId] ?? "";
}
