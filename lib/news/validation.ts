import { z } from "zod";

export const NEWS_STATUSES = ["draft", "published", "scheduled", "archived"] as const;
export type NewsStatus = (typeof NEWS_STATUSES)[number];

export const newsCreateSchema = z.object({
  title: z.string().trim().min(1, "Le titre est obligatoire").max(300),
  slug: z.string().trim().min(1, "Le slug est obligatoire").max(300).regex(/^[a-z0-9-]+$/, "Slug invalide"),
  excerpt: z.string().trim().min(1, "La description courte est obligatoire").max(500),
  content: z.string().min(1, "Le contenu est obligatoire"),
  category: z.string().trim().min(1, "La catégorie est obligatoire").max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  emoji: z.string().max(10).optional(),
  image: z.string().max(2048).nullable().optional(),
  status: z.enum(NEWS_STATUSES).optional(),
  featured: z.boolean().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  readingTime: z.number().int().positive().max(600).optional(),
  keyTakeaway: z.string().max(500).nullable().optional(),
  summary: z.array(z.string()).nullable().optional(),
  linkedDocs: z.array(z.object({ title: z.string(), url: z.string() })).nullable().optional(),
  faqs: z.array(z.object({ q: z.string(), a: z.string() })).nullable().optional(),
});

export const newsUpdateSchema = newsCreateSchema.partial().extend({
  publishedAt: z.string().datetime().nullable().optional(),
});

export const newsListQuerySchema = z.object({
  status: z.string().optional().default("all"),
  category: z.string().optional().default("all"),
  featured: z.string().optional(),
  search: z.string().optional().default(""),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(["title", "status", "createdAt", "views", "publishedAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const scheduleSchema = z.object({
  scheduledAt: z.string().datetime(),
});

export const bulkActionSchema = z.object({
  action: z.enum(["publish", "unpublish", "archive", "delete"]),
  ids: z.array(z.string().min(1)).min(1).max(500),
});
