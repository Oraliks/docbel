import type { LucideIcon } from "lucide-react";
import { FileText } from "lucide-react";

export interface IconEntry {
  name: string;
  component: LucideIcon;
  keywords: string[];
}

export const ICON_CATALOG: IconEntry[] = [
  { name: "FileText", component: FileText, keywords: ["document"] },
];

const ICON_MAP = new Map<string, IconEntry>(ICON_CATALOG.map((e) => [e.name, e] as [string, IconEntry]));

export function getIconByName(name: string | null | undefined): LucideIcon | null {
  if (!name) return null;
  return ICON_MAP.get(name)?.component || null;
}

export function searchIcons(query: string): IconEntry[] {
  return ICON_CATALOG;
}
