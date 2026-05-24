/**
 * Helpers partagés du module Assistant IA Chômage.
 *
 * Labels, icônes, helpers de formatage (dates, tokens, taille de contenu)
 * réutilisés par les composants Sources / Chat / Prompt Builder.
 */

import {
  FileText,
  Link2,
  ListChecks,
  Mic,
  ImageIcon,
  Type,
  type LucideIcon,
} from "lucide-react";

export const KIND_LABELS: Record<string, string> = {
  text: "Texte",
  url: "URL",
  tutorial: "Tutoriel",
  video_transcript: "Transcript vidéo",
  image_caption: "Image",
  pdf: "PDF",
};

export const KIND_ICONS: Record<string, LucideIcon> = {
  text: Type,
  url: Link2,
  tutorial: ListChecks,
  video_transcript: Mic,
  image_caption: ImageIcon,
  pdf: FileText,
};

export const KIND_COLORS: Record<string, string> = {
  text: "#64748b",
  url: "#3b82f6",
  tutorial: "#8b5cf6",
  video_transcript: "#ec4899",
  image_caption: "#f59e0b",
  pdf: "#ef4444",
};

export function getKindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

export function getKindIcon(kind: string): LucideIcon {
  return KIND_ICONS[kind] ?? FileText;
}

export function getKindColor(kind: string): string {
  return KIND_COLORS[kind] ?? "#64748b";
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-BE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(iso);
  }
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-BE", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

export function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso).getTime();
    const diff = Date.now() - d;
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return "à l'instant";
    const min = Math.floor(sec / 60);
    if (min < 60) return `il y a ${min} min`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `il y a ${hr}h`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `il y a ${day}j`;
    return fmtDate(iso);
  } catch {
    return "—";
  }
}

export function fmtBytes(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function fmtTokens(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n < 1000) return `${n}`;
  return `${(n / 1000).toFixed(1)}K`;
}

/**
 * Tronque un texte à la longueur donnée en ajoutant "…" si nécessaire.
 */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}
