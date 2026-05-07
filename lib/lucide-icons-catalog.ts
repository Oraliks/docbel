import {
  // Documents
  FileText, File, FileCheck, FilePlus, FilePen, FileSpreadsheet, FileSignature,
  Files, Folder, FolderOpen, Archive, Paperclip, BookOpen, Book, Bookmark,
  // Personnes
  User, Users, UserCheck, UserPlus, UserCircle, UserMinus, Briefcase,
  // Communication
  Mail, MessageCircle, Send, Phone, Smartphone, AtSign, Megaphone,
  // Argent
  DollarSign, Euro, CreditCard, Banknote, Wallet, Coins, Calculator,
  Receipt, PiggyBank, TrendingUp, TrendingDown, Percent,
  // Temps
  Calendar, Clock, AlarmClock, Hourglass, CalendarDays, CalendarCheck,
  Timer,
  // Lieux
  MapPin, Home, Map as MapIcon, Building, Building2, Globe, Globe2, LandPlot,
  // Travail
  Hammer, Wrench, Settings, HardHat, Cog,
  // Légal / officiel
  Award, Gavel, Scale, Stamp, ShieldCheck, ShieldAlert, Lock, Unlock,
  Key, Fingerprint, Shield,
  // Statut / feedback
  Check, CheckCircle, CircleCheck, X, XCircle, AlertCircle, AlertTriangle,
  Info, HelpCircle, Star, BadgeCheck,
  // Vie / santé / famille
  Heart, HeartPulse, Baby, GraduationCap, Hospital, Pill, Activity,
  // Transport
  Car, Train, Bus, Plane, Bike, Truck,
  // Divers utiles
  Hash, Tag, Bell, Eye, EyeOff, Search, Filter, Plus, Minus, Pencil,
  Save, Download, Upload, Share, Link as LinkIcon, ExternalLink,
  ClipboardList, ClipboardCheck, ClipboardCopy, List, ListChecks,
  Layers, LayoutGrid, Sparkles, Zap, Rocket, Flag, Target,
  type LucideIcon,
} from "lucide-react";

export interface IconEntry {
  name: string;
  component: LucideIcon;
  keywords: string[];
}

// Catalogue curated avec mots-clés pour la recherche FR/NL/EN
export const ICON_CATALOG: IconEntry[] = [
  // Documents
  { name: "FileText", component: FileText, keywords: ["document", "fichier", "papier", "text"] },
  { name: "File", component: File, keywords: ["fichier", "document"] },
  { name: "FileCheck", component: FileCheck, keywords: ["validé", "vérifié", "ok"] },
  { name: "FilePlus", component: FilePlus, keywords: ["nouveau", "ajouter"] },
  { name: "FilePen", component: FilePen, keywords: ["modifier", "éditer", "écrire"] },
  { name: "FileSpreadsheet", component: FileSpreadsheet, keywords: ["tableau", "excel", "calcul"] },
  { name: "FileSignature", component: FileSignature, keywords: ["signature", "signé", "contrat"] },
  { name: "Files", component: Files, keywords: ["fichiers", "dossier"] },
  { name: "Folder", component: Folder, keywords: ["dossier", "classeur"] },
  { name: "FolderOpen", component: FolderOpen, keywords: ["dossier", "ouvert"] },
  { name: "Archive", component: Archive, keywords: ["archive", "boîte"] },
  { name: "Paperclip", component: Paperclip, keywords: ["pièce jointe", "trombone"] },
  { name: "BookOpen", component: BookOpen, keywords: ["livre", "guide", "tutoriel"] },
  { name: "Book", component: Book, keywords: ["livre", "manuel"] },
  { name: "Bookmark", component: Bookmark, keywords: ["favori", "marque-page"] },

  // Personnes
  { name: "User", component: User, keywords: ["utilisateur", "personne", "individu"] },
  { name: "Users", component: Users, keywords: ["groupe", "équipe", "personnes"] },
  { name: "UserCheck", component: UserCheck, keywords: ["validé", "approuvé"] },
  { name: "UserPlus", component: UserPlus, keywords: ["ajouter", "inscription"] },
  { name: "UserCircle", component: UserCircle, keywords: ["profil", "compte"] },
  { name: "UserMinus", component: UserMinus, keywords: ["retirer", "supprimer"] },
  { name: "Briefcase", component: Briefcase, keywords: ["travail", "emploi", "profession"] },

  // Communication
  { name: "Mail", component: Mail, keywords: ["email", "courrier"] },
  { name: "MessageCircle", component: MessageCircle, keywords: ["message", "chat"] },
  { name: "Send", component: Send, keywords: ["envoyer"] },
  { name: "Phone", component: Phone, keywords: ["téléphone", "appel"] },
  { name: "Smartphone", component: Smartphone, keywords: ["mobile", "gsm"] },
  { name: "AtSign", component: AtSign, keywords: ["arobase", "email"] },
  { name: "Megaphone", component: Megaphone, keywords: ["annonce", "alerte"] },

  // Argent / finance
  { name: "DollarSign", component: DollarSign, keywords: ["argent", "monnaie"] },
  { name: "Euro", component: Euro, keywords: ["euro", "argent", "monnaie"] },
  { name: "CreditCard", component: CreditCard, keywords: ["carte", "paiement"] },
  { name: "Banknote", component: Banknote, keywords: ["billet", "argent"] },
  { name: "Wallet", component: Wallet, keywords: ["portefeuille", "argent"] },
  { name: "Coins", component: Coins, keywords: ["monnaie", "pièces"] },
  { name: "Calculator", component: Calculator, keywords: ["calcul", "mathématiques"] },
  { name: "Receipt", component: Receipt, keywords: ["reçu", "facture"] },
  { name: "PiggyBank", component: PiggyBank, keywords: ["épargne", "tirelire"] },
  { name: "TrendingUp", component: TrendingUp, keywords: ["hausse", "augmentation"] },
  { name: "TrendingDown", component: TrendingDown, keywords: ["baisse", "diminution"] },
  { name: "Percent", component: Percent, keywords: ["pourcentage", "taux"] },

  // Temps
  { name: "Calendar", component: Calendar, keywords: ["calendrier", "date"] },
  { name: "CalendarDays", component: CalendarDays, keywords: ["calendrier", "jours"] },
  { name: "CalendarCheck", component: CalendarCheck, keywords: ["rendez-vous", "validé"] },
  { name: "Clock", component: Clock, keywords: ["horloge", "heure"] },
  { name: "AlarmClock", component: AlarmClock, keywords: ["alarme", "réveil"] },
  { name: "Hourglass", component: Hourglass, keywords: ["sablier", "temps", "attente"] },
  { name: "Timer", component: Timer, keywords: ["minuteur", "chronomètre"] },

  // Lieux
  { name: "MapPin", component: MapPin, keywords: ["lieu", "adresse", "localisation"] },
  { name: "Home", component: Home, keywords: ["maison", "domicile", "accueil"] },
  { name: "Map", component: MapIcon, keywords: ["carte", "plan"] },
  { name: "Building", component: Building, keywords: ["bâtiment", "entreprise", "société"] },
  { name: "Building2", component: Building2, keywords: ["immeuble", "bureau"] },
  { name: "Globe", component: Globe, keywords: ["monde", "international"] },
  { name: "Globe2", component: Globe2, keywords: ["pays", "europe"] },
  { name: "LandPlot", component: LandPlot, keywords: ["terrain", "parcelle"] },

  // Travail / outils
  { name: "Hammer", component: Hammer, keywords: ["marteau", "outil", "ouvrier"] },
  { name: "Wrench", component: Wrench, keywords: ["clé", "outil", "réparation"] },
  { name: "Settings", component: Settings, keywords: ["paramètres", "config", "réglage"] },
  { name: "HardHat", component: HardHat, keywords: ["construction", "ouvrier"] },
  { name: "Cog", component: Cog, keywords: ["engrenage", "config"] },

  // Légal / sécurité
  { name: "Award", component: Award, keywords: ["récompense", "médaille", "certification"] },
  { name: "Gavel", component: Gavel, keywords: ["marteau", "juge", "justice"] },
  { name: "Scale", component: Scale, keywords: ["balance", "justice", "équilibre"] },
  { name: "Stamp", component: Stamp, keywords: ["tampon", "cachet", "officiel"] },
  { name: "ShieldCheck", component: ShieldCheck, keywords: ["bouclier", "sécurité", "protection"] },
  { name: "ShieldAlert", component: ShieldAlert, keywords: ["alerte", "sécurité"] },
  { name: "Shield", component: Shield, keywords: ["bouclier", "protection"] },
  { name: "Lock", component: Lock, keywords: ["cadenas", "verrouillé"] },
  { name: "Unlock", component: Unlock, keywords: ["cadenas", "déverrouillé"] },
  { name: "Key", component: Key, keywords: ["clé", "accès"] },
  { name: "Fingerprint", component: Fingerprint, keywords: ["empreinte", "identité"] },
  { name: "BadgeCheck", component: BadgeCheck, keywords: ["badge", "vérifié"] },

  // Statut
  { name: "Check", component: Check, keywords: ["coché", "validé"] },
  { name: "CheckCircle", component: CheckCircle, keywords: ["validé", "ok"] },
  { name: "CircleCheck", component: CircleCheck, keywords: ["validé", "ok"] },
  { name: "X", component: X, keywords: ["fermer", "supprimer"] },
  { name: "XCircle", component: XCircle, keywords: ["erreur", "annulé"] },
  { name: "AlertCircle", component: AlertCircle, keywords: ["alerte", "attention"] },
  { name: "AlertTriangle", component: AlertTriangle, keywords: ["danger", "attention"] },
  { name: "Info", component: Info, keywords: ["information"] },
  { name: "HelpCircle", component: HelpCircle, keywords: ["aide", "question"] },
  { name: "Star", component: Star, keywords: ["étoile", "favori"] },

  // Santé / famille
  { name: "Heart", component: Heart, keywords: ["coeur", "santé"] },
  { name: "HeartPulse", component: HeartPulse, keywords: ["santé", "battement"] },
  { name: "Baby", component: Baby, keywords: ["bébé", "enfant", "naissance"] },
  { name: "GraduationCap", component: GraduationCap, keywords: ["étude", "école", "diplôme"] },
  { name: "Hospital", component: Hospital, keywords: ["hôpital", "santé"] },
  { name: "Pill", component: Pill, keywords: ["pilule", "médicament"] },
  { name: "Activity", component: Activity, keywords: ["activité", "santé"] },

  // Transport
  { name: "Car", component: Car, keywords: ["voiture", "véhicule"] },
  { name: "Train", component: Train, keywords: ["train", "transport"] },
  { name: "Bus", component: Bus, keywords: ["bus", "transport"] },
  { name: "Plane", component: Plane, keywords: ["avion", "vol"] },
  { name: "Bike", component: Bike, keywords: ["vélo", "bicyclette"] },
  { name: "Truck", component: Truck, keywords: ["camion", "livraison"] },

  // Actions / divers
  { name: "Hash", component: Hash, keywords: ["dièse", "numéro"] },
  { name: "Tag", component: Tag, keywords: ["étiquette", "tag"] },
  { name: "Bell", component: Bell, keywords: ["cloche", "notification"] },
  { name: "Eye", component: Eye, keywords: ["œil", "voir"] },
  { name: "EyeOff", component: EyeOff, keywords: ["cacher", "masquer"] },
  { name: "Search", component: Search, keywords: ["recherche"] },
  { name: "Filter", component: Filter, keywords: ["filtrer"] },
  { name: "Plus", component: Plus, keywords: ["ajouter", "plus"] },
  { name: "Minus", component: Minus, keywords: ["retirer", "moins"] },
  { name: "Pencil", component: Pencil, keywords: ["crayon", "modifier"] },
  { name: "Save", component: Save, keywords: ["sauvegarder", "enregistrer"] },
  { name: "Download", component: Download, keywords: ["télécharger"] },
  { name: "Upload", component: Upload, keywords: ["envoyer", "uploader"] },
  { name: "Share", component: Share, keywords: ["partager"] },
  { name: "LinkIcon", component: LinkIcon, keywords: ["lien", "url"] },
  { name: "ExternalLink", component: ExternalLink, keywords: ["lien externe"] },
  { name: "ClipboardList", component: ClipboardList, keywords: ["liste", "presse-papier"] },
  { name: "ClipboardCheck", component: ClipboardCheck, keywords: ["validé", "checklist"] },
  { name: "ClipboardCopy", component: ClipboardCopy, keywords: ["copier"] },
  { name: "List", component: List, keywords: ["liste"] },
  { name: "ListChecks", component: ListChecks, keywords: ["liste", "validé"] },
  { name: "Layers", component: Layers, keywords: ["couches", "calques"] },
  { name: "LayoutGrid", component: LayoutGrid, keywords: ["grille", "tableau"] },
  { name: "Sparkles", component: Sparkles, keywords: ["étincelles", "magique", "nouveau"] },
  { name: "Zap", component: Zap, keywords: ["éclair", "rapide"] },
  { name: "Rocket", component: Rocket, keywords: ["fusée", "lancement"] },
  { name: "Flag", component: Flag, keywords: ["drapeau", "marquer"] },
  { name: "Target", component: Target, keywords: ["cible", "objectif"] },
];

const ICON_MAP = new Map<string, IconEntry>(ICON_CATALOG.map((e) => [e.name, e] as [string, IconEntry]));

export function getIconByName(name: string | null | undefined): LucideIcon | null {
  if (!name) return null;
  return ICON_MAP.get(name)?.component || null;
}

export function searchIcons(query: string): IconEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return ICON_CATALOG;
  return ICON_CATALOG.filter((e) => {
    if (e.name.toLowerCase().includes(q)) return true;
    return e.keywords.some((k) => k.toLowerCase().includes(q));
  });
}
