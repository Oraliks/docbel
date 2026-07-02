import { Landmark, Scale, FileText, Gavel, BookText, type LucideIcon } from "lucide-react";

export type NatureKey = "AR" | "AM" | "Loi-programme" | "Loi" | "Arrete-loi";

export interface NatureMeta {
  key: NatureKey;
  short: string;      // badge court (ex. "AR")
  label: string;      // libellé légende (ex. "Arrêté royal")
  icon: LucideIcon;
  accent: string;     // liseré gauche + point statut neutre (classe bg-*)
  tile: string;       // pastille d'icône : classes bg + text
}

export const NATURE_ORDER: NatureKey[] = ["AR", "AM", "Loi-programme", "Loi", "Arrete-loi"];

// Couleurs via échelles Tailwind neutres/vives cohérentes ProShell (pas de hex en dur criard).
const MAP: Record<NatureKey, NatureMeta> = {
  AR:             { key: "AR",             short: "AR",  label: "Arrêté royal",       icon: Landmark, accent: "bg-indigo-500", tile: "bg-indigo-50 text-indigo-600" },
  AM:             { key: "AM",             short: "AM",  label: "Arrêté ministériel", icon: Scale,    accent: "bg-amber-500",  tile: "bg-amber-50 text-amber-600" },
  "Loi-programme":{ key: "Loi-programme",  short: "L-P", label: "Loi-programme",      icon: FileText, accent: "bg-violet-500", tile: "bg-violet-50 text-violet-600" },
  Loi:            { key: "Loi",            short: "Loi", label: "Loi",                icon: BookText, accent: "bg-sky-500",    tile: "bg-sky-50 text-sky-600" },
  "Arrete-loi":   { key: "Arrete-loi",     short: "AL",  label: "Arrêté-loi",         icon: Gavel,    accent: "bg-slate-500",  tile: "bg-slate-100 text-slate-600" },
};

const FALLBACK: NatureMeta = {
  key: "Loi", short: "—", label: "Autre texte", icon: FileText,
  accent: "bg-slate-400", tile: "bg-slate-100 text-slate-600",
};

export function natureMeta(raw: string | null | undefined): NatureMeta {
  if (raw && raw in MAP) return MAP[raw as NatureKey];
  return FALLBACK;
}
