/** Résolution d'auth côté PAGE employeur (redirige plutôt que renvoyer un 401). */
import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export interface EmployerPageUser {
  id: string;
  isAdmin: boolean;
}

/**
 * Renvoie l'utilisateur si c'est un employeur (ou un admin, qui peut consulter),
 * sinon null — la page appelante redirige alors vers /p/employeur.
 */
export async function getEmployerPageUser(): Promise<EmployerPageUser | null> {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  const user = session?.user;
  if (!user) return null;
  if (user.role !== "employer" && user.role !== "admin") return null;
  return { id: user.id, isAdmin: user.role === "admin" };
}
