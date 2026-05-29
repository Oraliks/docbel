import { z } from "zod";
import type { VisualField, VisualFieldsDoc } from "./types";

/// Regex stricte v1 du nom de champ. Plus restrictive que la spec PDF
/// (qui autorise points, espaces, accents…) afin d'éviter les collisions
/// avec les hierarchies `parent.child` d'AcroForm et les caractères mal
/// échappés. On garde alphanum + tiret + underscore.
export const FIELD_NAME_RE = /^[a-zA-Z0-9_\-]{1,127}$/;

/// Largeur/hauteur minimales acceptées (points) — sous ce seuil les widgets
/// deviennent inutilisables (clic impossible) et peuvent corrompre les
/// apparences. Garde-fou.
export const MIN_DIM = 4;
/// Maximum cohérent avec page A0 (3370pt).
export const MAX_DIM = 5000;

const rectSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  w: z.number().finite().min(MIN_DIM).max(MAX_DIM),
  h: z.number().finite().min(MIN_DIM).max(MAX_DIM),
});

const baseFieldSchema = z.object({
  id: z.string().min(1).max(64),
  page: z.number().int().nonnegative(),
  name: z.string().regex(FIELD_NAME_RE, "Nom invalide (a-z, 0-9, _ ou -, max 127)"),
  rect: rectSchema,
  tooltip: z.string().max(512).optional(),
  required: z.boolean().optional(),
  readOnly: z.boolean().optional(),
});

const textFieldSchema = baseFieldSchema.extend({
  type: z.literal("text"),
  maxLen: z.number().int().positive().max(10000).optional(),
  multiline: z.boolean().optional(),
  defaultValue: z.string().max(2048).optional(),
});

const checkboxFieldSchema = baseFieldSchema.extend({
  type: z.literal("checkbox"),
  defaultChecked: z.boolean().optional(),
});

export const visualFieldSchema = z.discriminatedUnion("type", [
  textFieldSchema,
  checkboxFieldSchema,
]);

export const visualFieldsDocSchema = z
  .object({
    version: z.literal(1),
    fields: z.array(visualFieldSchema).max(500),
    materializedNames: z.array(z.string()).optional(),
  })
  .superRefine((doc, ctx) => {
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    doc.fields.forEach((f, i) => {
      if (seenIds.has(f.id)) {
        ctx.addIssue({ code: "custom", path: ["fields", i, "id"], message: `Identifiant dupliqué : ${f.id}` });
      }
      seenIds.add(f.id);
      if (seenNames.has(f.name)) {
        ctx.addIssue({ code: "custom", path: ["fields", i, "name"], message: `Nom de champ dupliqué : ${f.name}` });
      }
      seenNames.add(f.name);
    });
  });

export interface ValidationResult {
  ok: boolean;
  doc?: VisualFieldsDoc;
  errors?: { path: string; message: string }[];
}

export function validateVisualFieldsDoc(raw: unknown): ValidationResult {
  const res = visualFieldsDocSchema.safeParse(raw);
  if (!res.success) {
    return {
      ok: false,
      errors: res.error.issues.map((iss) => ({
        path: iss.path.join("."),
        message: iss.message,
      })),
    };
  }
  return { ok: true, doc: res.data as VisualFieldsDoc };
}

/// Vrai si le doc contient au moins un champ ; utile pour les checks de
/// publication (warning si non matérialisé).
export function hasDraftFields(doc: VisualFieldsDoc): boolean {
  return doc.fields.length > 0;
}

/// Vrai si le doc a été modifié depuis la dernière matérialisation, en
/// comparant les noms persistés dans `materializedNames` au set courant.
export function isDocDirtyVsMaterialized(doc: VisualFieldsDoc): boolean {
  const current = new Set(doc.fields.map((f) => f.name));
  const last = new Set(doc.materializedNames ?? []);
  if (current.size !== last.size) return true;
  for (const n of current) if (!last.has(n)) return true;
  return false;
}

/// Vérifie qu'aucun nom de champ visuel ne collisionne avec un nom déjà
/// présent dans l'AcroForm source (utilisé côté serveur avant matérialisation).
export function findNameCollisions(doc: VisualFieldsDoc, existingNames: string[]): string[] {
  const set = new Set(existingNames);
  return doc.fields.map((f) => f.name).filter((n) => set.has(n));
}

/// Vrai si un nom de champ candidat est libre dans le doc (utilisé côté UI).
export function isNameAvailable(doc: VisualFieldsDoc, name: string, excludeFieldId?: string): boolean {
  return !doc.fields.some((f) => f.name === name && f.id !== excludeFieldId);
}

/// Génère un nom de champ libre à partir d'un préfixe (utilisé côté UI lors
/// de la création d'un nouveau champ).
export function generateFieldName(doc: VisualFieldsDoc, prefix: string): string {
  const base = prefix.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 100) || "field";
  let i = 1;
  let candidate = base;
  while (!isNameAvailable(doc, candidate)) {
    i += 1;
    candidate = `${base}_${i}`;
  }
  return candidate;
}

/// Vrai si `field` est de type texte (narrow helper UI).
export function isTextField(f: VisualField): f is Extract<VisualField, { type: "text" }> {
  return f.type === "text";
}
