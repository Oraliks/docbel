import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/// Un balayage manuel (S8 de l'audit du 2026-08-01) ne tient que jusqu'à la
/// prochaine route ajoutée. Ce test le rend permanent : tout handler mutateur
/// des routes admin PDF doit passer par `ensureWriteAllowed`, faute de quoi le
/// mode « voir en tant que » (impersonation en lecture seule) et les comptes de
/// démo pourraient écrire — ce que le garde existe précisément pour empêcher.

const ADMIN_API_ROOT = path.resolve(process.cwd(), "app/api/admin");
const MUTATING = ["POST", "PUT", "PATCH", "DELETE"] as const;

/// Handlers volontairement NON gardés, chacun avec sa raison. Ajouter une
/// entrée ici est un choix explicite, pas un oubli silencieux.
const EXEMPTIONS: Record<string, string> = {
  "pdf/cron/purge-drafts/route.ts::POST":
    "Cron : authentifié par CRON_SECRET, aucune session utilisateur à mettre en lecture seule.",
  "pdf/forms/[id]/test-generate/route.ts::POST":
    "N'écrit rien : rend un PDF d'aperçu en flux. Le bloquer priverait un admin en lecture seule d'une lecture.",
};

/// Tous les `route.ts` sous app/api/admin dont le chemin mentionne « pdf ».
function findPdfRouteFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findPdfRouteFiles(full, acc);
    else if (entry.name === "route.ts") acc.push(full);
  }
  return acc.filter((f) => path.relative(ADMIN_API_ROOT, f).replace(/\\/g, "/").includes("pdf"));
}

interface Handler {
  /// Chemin relatif POSIX + méthode, ex. « pdf/forms/[id]/route.ts::PATCH ».
  key: string;
  method: string;
  guarded: boolean;
}

/// Découpe un fichier de route en handlers exportés et dit lesquels appellent
/// le garde. Analyse textuelle assumée : le corps d'un handler court jusqu'à
/// l'export suivant, ce qui suffit ici (un seul `ensureWriteAllowed` par
/// handler, jamais imbriqué).
function readHandlers(file: string): Handler[] {
  const source = readFileSync(file, "utf-8");
  const relative = path.relative(ADMIN_API_ROOT, file).replace(/\\/g, "/");
  const parts = source.split(/(export\s+async\s+function\s+(?:GET|POST|PUT|PATCH|DELETE)\s*\()/);
  const handlers: Handler[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const method = parts[i].match(/function\s+(\w+)/)?.[1];
    if (!method) continue;
    handlers.push({
      key: `${relative}::${method}`,
      method,
      guarded: parts[i + 1].includes("ensureWriteAllowed()"),
    });
  }
  return handlers;
}

const handlers = findPdfRouteFiles(ADMIN_API_ROOT).flatMap(readHandlers);

describe("routes admin PDF — garde d'écriture (impersonation / comptes démo)", () => {
  it("trouve bien des handlers à contrôler (le test ne passe pas à vide)", () => {
    expect(handlers.length).toBeGreaterThan(15);
    expect(handlers.some((h) => h.method === "PATCH")).toBe(true);
  });

  it("tout handler mutateur appelle ensureWriteAllowed, sauf exemption déclarée", () => {
    const manquants = handlers
      .filter((h) => (MUTATING as readonly string[]).includes(h.method))
      .filter((h) => !h.guarded)
      .filter((h) => !(h.key in EXEMPTIONS))
      .map((h) => h.key);
    expect(manquants).toEqual([]);
  });

  it("aucun GET n'est gardé — le mode lecture seule doit rester lisible", () => {
    const enTrop = handlers.filter((h) => h.method === "GET" && h.guarded).map((h) => h.key);
    expect(enTrop).toEqual([]);
  });

  it("chaque exemption déclarée correspond à un handler qui existe encore", () => {
    // Sans ce contrôle, une exemption survivrait à la suppression de sa route
    // et couvrirait un jour un handler homonyme, gardé pour de mauvaises raisons.
    const cles = new Set(handlers.map((h) => h.key));
    const perimees = Object.keys(EXEMPTIONS).filter((k) => !cles.has(k));
    expect(perimees).toEqual([]);
  });
});
