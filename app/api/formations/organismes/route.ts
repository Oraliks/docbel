import { apiError } from "@/lib/api/response";

export const runtime = "nodejs";

// L'inscription self-service créait aussi un User/Account, même en attente.
// Le module et les organismes existants restent disponibles à l'administration.
export async function POST() {
  return apiError(403, "Les inscriptions publiques sont fermées.", {
    code: "public_registration_closed",
  });
}
