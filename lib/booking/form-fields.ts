// Formulaire configurable par tenant : registre fermé de types de champs +
// construction d'un schéma Zod à la volée (source de vérité côté client et
// serveur) + extraction de l'identité citoyen pour le dedupe et le routage.

import { z } from "zod";
import { normalizeName } from "@/lib/rendez-vous/history";
import type {
  BookingField,
  BookingFieldType,
  CitizenIdentity,
} from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const BOOKING_FIELD_TYPES: BookingFieldType[] = [
  "text",
  "email",
  "tel",
  "textarea",
  "select",
  "checkbox",
  "date",
  "nrn",
  "postal_code",
];

/**
 * Valide un numéro de registre national belge (11 chiffres, contrôle mod-97).
 * Gère les naissances avant et après 2000.
 */
export function isValidNrn(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  const base = Number(digits.slice(0, 9));
  const check = Number(digits.slice(9, 11));
  if (97 - (base % 97) === check) return true; // né avant 2000
  if (97 - (Number("2" + digits.slice(0, 9)) % 97) === check) return true; // né après 2000
  return false;
}

/** Schéma Zod d'un champ unique (tient compte de required). */
function fieldSchema(f: BookingField): z.ZodTypeAny {
  const req = f.required ?? false;
  // Champ non requis : autorise undefined ou chaîne vide.
  const opt = (s: z.ZodTypeAny) => (req ? s : s.optional().or(z.literal("")));

  switch (f.type) {
    case "email":
      return opt(z.string().regex(EMAIL_RE, "Adresse email invalide"));
    case "tel":
      return opt(z.string().min(req ? 1 : 0).max(40));
    case "text":
    case "textarea": {
      let s = z.string().max(f.maxLength ?? (f.type === "textarea" ? 2000 : 200));
      if (req) s = s.min(1, "Ce champ est obligatoire");
      return opt(s);
    }
    case "select": {
      const opts = f.options ?? [];
      return opt(
        z
          .string()
          .refine((v) => opts.length === 0 || opts.includes(v), "Choix invalide"),
      );
    }
    case "checkbox":
      return req
        ? z.boolean().refine((v) => v === true, "Cochez cette case pour continuer")
        : z.boolean().optional();
    case "date":
      return opt(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide"));
    case "nrn":
      return opt(
        z.string().refine(isValidNrn, "Numéro de registre national invalide"),
      );
    case "postal_code":
      return opt(z.string().regex(/^\d{4}$/, "Code postal invalide (4 chiffres)"));
    default:
      return opt(z.string());
  }
}

export function buildFormSchema(fields: BookingField[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) shape[f.key] = fieldSchema(f);
  return z.object(shape);
}

export function validateFormData(
  fields: BookingField[],
  data: unknown,
):
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; message: string } {
  const result = buildFormSchema(fields).safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      message: result.error.issues[0]?.message ?? "Formulaire invalide",
    };
  }
  return { ok: true, data: result.data as Record<string, unknown> };
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return v == null ? null : String(v);
  const t = v.trim();
  return t.length ? t : null;
}

/** Extrait l'identité citoyen des réponses, selon les rôles des champs. */
export function extractIdentity(
  fields: BookingField[],
  data: Record<string, unknown>,
): CitizenIdentity {
  const pick = (pred: (f: BookingField) => boolean) => {
    const f = fields.find(pred);
    return f ? str(data[f.key]) : null;
  };

  const email = pick((f) => f.role === "email" || f.type === "email");
  const phone = pick((f) => f.role === "phone" || f.type === "tel");
  const nrnRaw = pick((f) => f.role === "nrn" || f.type === "nrn");
  const postalCode = pick(
    (f) => f.role === "postal_code" || f.type === "postal_code",
  );

  const nameParts = fields
    .filter((f) => f.role === "name")
    .map((f) => str(data[f.key]))
    .filter((v): v is string => !!v);
  let name = nameParts.join(" ").trim() || null;
  if (!name) {
    const nf = fields.find((f) => f.type === "text" && /nom|name/i.test(f.key));
    if (nf) name = str(data[nf.key]);
  }

  const nrnDigits = nrnRaw ? nrnRaw.replace(/\D/g, "") : null;

  return {
    name,
    nameNormalized: name ? normalizeName(name) : null,
    email: email ? email.toLowerCase() : null,
    phone,
    nrn: nrnDigits && nrnDigits.length === 11 ? nrnDigits : null,
    postalCode,
  };
}

/**
 * Retire les valeurs des champs sensibles (type "nrn") du formData brut avant
 * stockage. Le NRN est conservé séparément, haché (HMAC) + 4 derniers chiffres.
 * RGPD : on ne garde jamais le NRN en clair dans `Booking.formData`.
 */
export function redactSensitiveFormData(
  fields: BookingField[],
  data: Record<string, unknown>,
): Record<string, unknown> {
  const sensitiveKeys = new Set(
    fields.filter((f) => f.type === "nrn").map((f) => f.key),
  );
  if (sensitiveKeys.size === 0) return data;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!sensitiveKeys.has(k)) out[k] = v;
  }
  return out;
}

// --- Validation de la configuration (ce qu'un tenant peut enregistrer) -------

export const bookingFieldDefSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Clé invalide (lettres/chiffres)"),
  label: z.string().min(1).max(80),
  type: z.enum([
    "text",
    "email",
    "tel",
    "textarea",
    "select",
    "checkbox",
    "date",
    "nrn",
    "postal_code",
  ]),
  required: z.boolean().optional(),
  options: z.array(z.string().min(1).max(80)).max(50).optional(),
  maxLength: z.number().int().positive().max(5000).optional(),
  placeholder: z.string().max(120).optional(),
  role: z.enum(["name", "email", "phone", "nrn", "postal_code"]).optional(),
});

export const bookingFormFieldsSchema = z.array(bookingFieldDefSchema).max(25);

/** Lit/valide la config stockée en base ; retombe sur le formulaire par défaut. */
export function parseFormFields(json: unknown): BookingField[] {
  const result = bookingFormFieldsSchema.safeParse(json);
  if (result.success && result.data.length > 0) {
    return result.data as BookingField[];
  }
  return DEFAULT_BOOKING_FORM;
}

/** Formulaire chômage par défaut (les 4 organismes de paiement). */
export const DEFAULT_BOOKING_FORM: BookingField[] = [
  { key: "lastName", label: "Nom", type: "text", required: true, role: "name", maxLength: 80 },
  { key: "firstName", label: "Prénom", type: "text", required: true, role: "name", maxLength: 80 },
  { key: "email", label: "Adresse email", type: "email", required: true, role: "email" },
  { key: "phone", label: "Téléphone", type: "tel", required: false, role: "phone" },
  {
    key: "nrn",
    label: "Numéro de registre national",
    type: "nrn",
    required: false,
    role: "nrn",
  },
  {
    key: "postalCode",
    label: "Code postal de domicile",
    type: "postal_code",
    required: true,
    role: "postal_code",
  },
  {
    key: "motive",
    label: "Objet du rendez-vous",
    type: "textarea",
    required: false,
    maxLength: 300,
  },
];
