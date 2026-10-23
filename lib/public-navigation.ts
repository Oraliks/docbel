/** Routes whose own question/action controls replace the mobile primary nav. */
export function isPublicJourney(pathname: string): boolean {
  return pathname === "/onboarding" || pathname.startsWith("/onboarding/") ||
    pathname.startsWith("/d/") || pathname.startsWith("/document/") ||
    pathname === "/outils/ma-situation-familiale";
}

export function isPublicNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/mon-dossier") return (isPublicJourney(pathname) && !pathname.startsWith("/outils/")) ||
    ["/mon-dossier", "/mes-demarches", "/reprendre"].some(path => pathname === path || pathname.startsWith(path + "/"));
  return pathname === href || pathname.startsWith(href + "/");
}
