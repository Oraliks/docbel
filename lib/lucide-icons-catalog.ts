import type { LucideIcon } from "lucide-react";
import {
  FileText,
  // Batch calculateurs citoyens 2026-05 (cf. lib/calculators/*).
  Wallet,
  Plane,
  Coins,
  FileSignature,
  Hourglass,
  Baby,
  Calculator,
  Zap,
  Car,
  // Anciens outils TOOLS_DATA (préavis, bureaux, lookup ONEM).
  Calendar,
  MapPin,
  Search,
  Accessibility,
  Briefcase,
  FolderOpen,
  GraduationCap,
  HandHeart,
  HeartPulse,
  HelpCircle,
  Home,
  MapPinned,
  Sparkles,
  UserMinus,
  Users,
} from "lucide-react";

export interface IconEntry {
  name: string;
  component: LucideIcon;
  keywords: string[];
}

export const ICON_CATALOG: IconEntry[] = [
  { name: "FileText", component: FileText, keywords: ["document"] },
  { name: "Accessibility", component: Accessibility, keywords: ["accessibilité", "handicap"] },
  { name: "Briefcase", component: Briefcase, keywords: ["emploi", "travail", "carrière"] },
  { name: "FolderOpen", component: FolderOpen, keywords: ["dossier", "répertoire"] },
  { name: "GraduationCap", component: GraduationCap, keywords: ["études", "formation", "école"] },
  { name: "HandHeart", component: HandHeart, keywords: ["aide", "social", "solidarité"] },
  { name: "HeartPulse", component: HeartPulse, keywords: ["santé", "maladie", "soins"] },
  { name: "HelpCircle", component: HelpCircle, keywords: ["aide", "question", "autre"] },
  { name: "Home", component: Home, keywords: ["logement", "maison", "adresse"] },
  { name: "MapPinned", component: MapPinned, keywords: ["carte", "adresse", "lieu"] },
  { name: "Sparkles", component: Sparkles, keywords: ["assistant", "nouveau", "magie"] },
  { name: "UserMinus", component: UserMinus, keywords: ["perte emploi", "licenciement", "personne"] },
  { name: "Users", component: Users, keywords: ["famille", "groupe", "ménage"] },
  // Batch calculateurs citoyens — icônes utilisées par les outils calc_*
  // listés dans lib/docbel-data.ts. Les keywords servent au search du
  // <IconPicker/> admin (FR + EN).
  { name: "Wallet", component: Wallet, keywords: ["salaire", "brut", "net", "argent", "wallet", "money"] },
  { name: "Plane", component: Plane, keywords: ["vacances", "pécule", "voyage", "holiday", "plane"] },
  { name: "Coins", component: Coins, keywords: ["chômage", "allocation", "pièces", "monnaie", "coins"] },
  { name: "FileSignature", component: FileSignature, keywords: ["contrat", "rupture", "indemnité", "signature", "contract"] },
  { name: "Hourglass", component: Hourglass, keywords: ["pension", "retraite", "temps", "hourglass", "time"] },
  { name: "Baby", component: Baby, keywords: ["enfant", "allocations familiales", "famille", "bébé", "baby", "child"] },
  { name: "Calculator", component: Calculator, keywords: ["impôt", "ipp", "calcul", "calculator", "tax"] },
  { name: "Zap", component: Zap, keywords: ["énergie", "électricité", "tarif social", "zap", "energy"] },
  { name: "Car", component: Car, keywords: ["voiture", "frais kilométriques", "transport", "car"] },
  // Anciens outils
  { name: "Calendar", component: Calendar, keywords: ["calendrier", "date", "préavis", "délai", "calendar"] },
  { name: "MapPin", component: MapPin, keywords: ["bureau", "carte", "lieu", "localisation", "map", "pin"] },
  { name: "Search", component: Search, keywords: ["recherche", "lookup", "search", "loupe"] },
];

const ICON_MAP = new Map<string, IconEntry>(ICON_CATALOG.map((e) => [e.name, e] as [string, IconEntry]));

export function getIconByName(name: string | null | undefined): LucideIcon | null {
  if (!name) return null;
  return ICON_MAP.get(name)?.component || null;
}

export function searchIcons(query: string): IconEntry[] {
  if (!query.trim()) return ICON_CATALOG;
  const q = query.toLowerCase().trim();
  return ICON_CATALOG.filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      e.keywords.some((k) => k.toLowerCase().includes(q)),
  );
}
