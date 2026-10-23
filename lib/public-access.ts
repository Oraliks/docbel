// Temporary closure during site work. Server guards remain authoritative.
// Reopening requires reviewing the corresponding auth/proxy guards as well.
export const PUBLIC_WRITES_PAUSED: boolean = true;
export type TemporaryClosureKind = "signup" | "booking" | "dossier" | "existing" | "ephemeral" | "profile";
export function temporaryClosureForPath(pathname: string): TemporaryClosureKind | null {
  if (!PUBLIC_WRITES_PAUSED) return null;
  if (pathname === "/inscription" || pathname.startsWith("/inscription/")) return "signup";
  if (pathname === "/rendez-vous" || pathname === "/rendez-vous/guichets" || /^\/[^/]+\/rendez-vous\/?$/.test(pathname)) return "booking";
  return null;
}
