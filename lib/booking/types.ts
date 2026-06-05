// Types partagés de la plateforme de booking (sans dépendance runtime, pour
// pouvoir être importés côté client comme serveur).

export type BookingFieldType =
  | "text"
  | "email"
  | "tel"
  | "textarea"
  | "select"
  | "checkbox"
  | "date"
  | "nrn" // numéro de registre national belge
  | "postal_code"; // 4 chiffres — sert au routage commune → antenne

/** Sémantique d'un champ : extraction de l'identité + routage. */
export type BookingFieldRole = "name" | "email" | "phone" | "nrn" | "postal_code";

export interface BookingField {
  key: string;
  label: string;
  type: BookingFieldType;
  required?: boolean;
  options?: string[]; // pour type "select"
  maxLength?: number; // pour "text" / "textarea"
  placeholder?: string;
  role?: BookingFieldRole;
}

/** Définition d'un créneau (règle hebdo ou slot d'exception). */
export interface SlotDef {
  startTime: string; // "09:00"
  endTime: string; // "10:00"
  capacity: number;
  serviceCode?: string | null;
}

export interface AvailableSlot extends SlotDef {
  remaining: number;
}

export interface DayAvailability {
  date: string; // "YYYY-MM-DD"
  weekday: number; // 0=dim … 6=sam
  slots: AvailableSlot[];
}

/** Identité citoyen extraite des réponses du formulaire (dedupe + routage). */
export interface CitizenIdentity {
  name: string | null;
  nameNormalized: string | null;
  email: string | null;
  phone: string | null;
  nrn: string | null; // 11 chiffres validés, sinon null
  postalCode: string | null;
}
