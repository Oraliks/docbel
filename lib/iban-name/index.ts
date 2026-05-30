/// Module de vérification IBAN ↔ titulaire (SEPA VOP).
///
/// **État** : scaffold pour intégration future. Le checksum IBAN (mod-97) est
/// déjà couvert par `isValidBelgianIBAN` dans `lib/pdf-forms/validators.ts` ;
/// ici on prépare la vérification du **nom du titulaire** via un provider
/// externe (SurePay, Finologee…) sans la câbler en production.
///
/// **Activation** :
///   1. Implémenter un provider concret (cf. `MockProvider` ci-dessous).
///   2. Définir `IBAN_NAME_PROVIDER=mock|surepay|…` côté env.
///   3. La route `/api/iban/verify-name` répondra alors 200 au lieu de 503.

import type { IbanNameVerifier, IbanNameVerifyInput, IbanNameVerifyOutput } from "./types";
import { isValidBelgianIBAN, isValidInternationalIBAN } from "@/lib/pdf-forms/validators";

export type * from "./types";

/// Provider mock pour développement et tests. Règles simples :
/// - IBAN invalide (checksum) → unable_to_verify
/// - Nom contient "TEST_MATCH" → match
/// - Nom contient "TEST_CLOSE" → close_match (suggère "Jean Dupont")
/// - Nom contient "TEST_NO"   → no_match
/// - Par défaut → close_match (pour démontrer le flux sans bloquer le dev)
class MockProvider implements IbanNameVerifier {
  readonly name = "mock";

  async verify({ iban, name }: IbanNameVerifyInput): Promise<IbanNameVerifyOutput> {
    const cleaned = iban.replace(/\s+/g, "").toUpperCase();
    const valid = isValidBelgianIBAN(cleaned) || isValidInternationalIBAN(cleaned);
    if (!valid) return { match: "unable_to_verify", provider: this.name };

    const n = name.toUpperCase();
    if (n.includes("TEST_MATCH")) return { match: "match", provider: this.name };
    if (n.includes("TEST_NO")) return { match: "no_match", provider: this.name };
    if (n.includes("TEST_CLOSE"))
      return { match: "close_match", suggestedName: "Jean Dupont", provider: this.name };
    return { match: "close_match", suggestedName: name.trim(), provider: this.name };
  }
}

/// Pointeur vers le provider actif. `null` = vérification désactivée.
export function getIbanNameVerifier(): IbanNameVerifier | null {
  const id = process.env.IBAN_NAME_PROVIDER?.toLowerCase();
  if (!id || id === "none" || id === "disabled") return null;
  if (id === "mock") return new MockProvider();
  // Ajouter ici d'autres providers : surepay, finologee…
  // if (id === "surepay") return new SurePayProvider();
  return null;
}

export function isIbanNameCheckEnabled(): boolean {
  return getIbanNameVerifier() !== null;
}
