import { z } from "zod";

export const CHANGELOG_TYPES = ["feature", "fix", "improvement", "breaking"] as const;
export type ChangelogType = (typeof CHANGELOG_TYPES)[number];

// Versions look like "1.2.3" / "v2.0" / "2026.05.12" — keep it permissive but
// safe for URL anchors (a-z, 0-9, dot, dash).
const versionRegex = /^[a-zA-Z0-9.\-_]+$/;

export const changelogCreateSchema = z.object({
  version: z
    .string()
    .trim()
    .min(1, "La version est obligatoire")
    .max(50)
    .regex(versionRegex, "Version invalide (a-z, 0-9, point, tiret uniquement)"),
  publishedAt: z.string().datetime(),
  type: z.enum(CHANGELOG_TYPES),
  title: z.string().trim().min(1, "Le titre est obligatoire").max(300),
  // Description riche : on autorise jusqu'à 10 000 caractères (texte multi-section,
  // emojis, listes). Au-delà, le contenu mérite probablement un article dédié.
  description: z.string().max(10000).optional().default(""),
  changes: z.array(z.string().trim().min(1).max(1000)).default([]),
});

export const changelogUpdateSchema = changelogCreateSchema.partial();

export const changelogListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  since: z.string().datetime().optional(),
});

export type ChangelogCreateInput = z.infer<typeof changelogCreateSchema>;
export type ChangelogUpdateInput = z.infer<typeof changelogUpdateSchema>;
