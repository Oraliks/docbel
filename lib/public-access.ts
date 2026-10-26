// Temporary closure during site work. Server guards remain authoritative.
// Reopening requires reviewing the corresponding auth/proxy guards as well.
export const PUBLIC_WRITES_PAUSED: boolean = true;

/// Opt-in de recette uniquement : ces variables ne sont publiées que dans le
/// build staging dédié. Les API restent protégées indépendamment par le proxy.
export function isStagingTestPersistenceEnabled(): boolean {
  return process.env.NEXT_PUBLIC_APP_ENV === "staging" &&
    process.env.NEXT_PUBLIC_STAGING_TEST_PERSISTENCE === "1";
}

export type TemporaryClosureKind = "signup" | "booking" | "dossier" | "existing" | "ephemeral" | "profile";
export function temporaryClosureForPath(pathname: string): TemporaryClosureKind | null {
  if (!PUBLIC_WRITES_PAUSED) return null;
  if (pathname === "/inscription" || pathname.startsWith("/inscription/")) return "signup";
  if (pathname === "/rendez-vous" || pathname === "/rendez-vous/guichets" || /^\/[^/]+\/rendez-vous\/?$/.test(pathname)) return "booking";
  return null;
}
