import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";

function closed() {
  return apiError(403, "L'enregistrement de dossiers est fermé.", {
    code: "public_persistence_closed",
    headers: { "Cache-Control": "no-store" },
  });
}

// Fermeture de fonctionnalité à la frontière HTTP, sans contrôle de rôle ni DB.
// Les gardes de propriété et requireAdminAuth restent dans leurs handlers.
export async function proxy(request: NextRequest) {
  // Décoder chaque segment séparément : un id contenant %2F reste UN paramètre.
  let parts: string[];
  try {
    parts = request.nextUrl.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    return NextResponse.next(); // chemin invalide : le routeur le refusera
  }
  const read = ["GET", "HEAD", "OPTIONS"].includes(request.method);
  if (parts[0] !== "api" || read) return NextResponse.next();

  if (parts.length === 3 && parts[1] === "user" && parts[2] === "profile") return closed();
  if (parts.length === 4 && parts[1] === "booking" && ["book", "waitlist"].includes(parts[3])) return closed();

  if (parts.length === 5 && parts[1] === "documents" && parts[2] === "bundles" && parts[4] === "run") {
    return closed();
  }
  if (parts[1] === "bundles" && parts[2] === "runs" &&
      (parts.length === 4 || (parts.length === 5 && parts[4] === "email-code"))) {
    return closed();
  }
  if (parts.length === 4 && parts[1] === "pdf" && parts[3] === "draft") {
    return closed();
  }
  if (request.method === "POST" && parts.length === 4 && parts[1] === "pdf" && parts[3] === "generate") {
    // Ne pas transformer un download+bundleRunId en sauvegarde implicite.
    // Le téléchargement autonome éphémère garde son handler et ses validations.
    let body: Record<string, unknown> | null;
    try {
      body = await request.clone().json();
    } catch {
      return apiError(400, "Invalid JSON", { code: "invalid_json" });
    }
    if (body?.delivery === "save" || typeof body?.bundleRunId === "string") return closed();
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*"] };
