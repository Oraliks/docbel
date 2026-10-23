import { apiError } from "@/lib/api/response";

// V1 publique : aucun nouveau compte visiteur/pro. La création administrative
// reste disponible sous requireAdminAuth dans /api/users ; données conservées.
export async function POST() {
  return apiError(403, "Les inscriptions publiques sont fermées.", {
    code: "public_registration_closed",
  });
}
