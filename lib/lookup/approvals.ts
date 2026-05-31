/**
 * Workflow "4 yeux" pour les LookupTable sensibles (requiresApproval=true) :
 * nombre d'approbations distinctes requises avant d'autoriser un import.
 *
 * Défini ici (et non dans un `route.ts`) car Next 16 interdit aux fichiers de
 * route d'exporter autre chose que les handlers HTTP + la config de route.
 * Miroir de lib/baremes/approveBaremeImport.ts (REQUIRED_APPROVALS_COUNT).
 */
export const REQUIRED_APPROVALS = 2;
