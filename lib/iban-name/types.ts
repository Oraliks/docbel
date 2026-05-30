/// Résultat normalisé d'une vérification IBAN ↔ titulaire (SEPA VOP /
/// "Verification of Payee"). Valeurs alignées avec le scheme EPC.
export type IbanNameMatch =
  /// Le nom exact correspond au titulaire du compte.
  | "match"
  /// Correspondance approximative (orthographe différente). La banque
  /// peut suggérer le nom officiel via `suggestedName`.
  | "close_match"
  /// Le nom ne correspond pas au titulaire.
  | "no_match"
  /// Vérification impossible (compte non SEPA, banque hors scheme, etc.).
  | "unable_to_verify";

export interface IbanNameVerifyInput {
  /// IBAN à vérifier (formaté ou non, la regex de nettoyage côté provider).
  iban: string;
  /// Nom du titulaire présumé. Personne physique ou raison sociale.
  name: string;
  /// `person` (personne physique) ou `business` (entité légale).
  /// Certains providers ajustent leur algo de matching selon ce flag.
  accountType?: "person" | "business";
}

export interface IbanNameVerifyOutput {
  match: IbanNameMatch;
  /// Nom officiel suggéré par la banque (uniquement en cas de `close_match`).
  suggestedName?: string;
  /// Identifiant de provider (ex. "mock", "surepay", "finologee").
  provider: string;
  /// Payload brut de réponse, opaque pour le caller. Conservé pour debug.
  raw?: unknown;
}

export interface IbanNameVerifier {
  /// Identifiant stable du provider (sert au logging / monitoring).
  readonly name: string;
  verify(input: IbanNameVerifyInput): Promise<IbanNameVerifyOutput>;
}
