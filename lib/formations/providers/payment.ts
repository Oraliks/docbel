/**
 * Abstraction paiement du module Formations. V2/V4 : AUCUN paiement réel tant
 * qu'un provider n'est pas configuré. Défaut = `manual` (suivi manuel côté
 * organisation). `mock` simule en dev. stripe/paypal = placeholders non câblés.
 * Voir docs/formations-api-setup.md.
 */
import "server-only";
import { nanoid } from "nanoid";

export type PaymentProviderName = "manual" | "mock" | "stripe" | "paypal" | "disabled";

export function getPaymentProvider(): PaymentProviderName {
  const v = (process.env.TRAINING_PAYMENT_PROVIDER || "manual").toLowerCase();
  return (["manual", "mock", "stripe", "paypal", "disabled"] as const).includes(
    v as PaymentProviderName,
  )
    ? (v as PaymentProviderName)
    : "manual";
}

export interface CreatePaymentInput {
  enrollmentId: string;
  amount: number;
  currency: string;
}

export interface PaymentResult {
  provider: PaymentProviderName;
  /** pending | confirmed | failed */
  status: string;
  reference?: string;
  redirectUrl?: string;
  message: string;
}

/** Crée un "paiement" — V2 sans API : manual/mock/disabled uniquement. */
export async function createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
  const provider = getPaymentProvider();
  switch (provider) {
    case "disabled":
      return { provider, status: "failed", message: "Le paiement est désactivé." };
    case "mock":
      return {
        provider,
        status: "confirmed",
        reference: `MOCK-${nanoid(10)}`,
        message: "Paiement simulé (environnement de test).",
      };
    case "stripe":
    case "paypal":
      // Placeholders : aucune clé API câblée. On retombe sur le suivi manuel.
      return {
        provider: "manual",
        status: "pending",
        message:
          "Provider non configuré : le paiement est géré manuellement par l'organisme. Docbel ne traite pas encore ce paiement.",
      };
    case "manual":
    default:
      return {
        provider: "manual",
        status: "pending",
        reference: `MAN-${nanoid(8)}`,
        message:
          "Le paiement est géré par l'organisme de formation. Docbel ne traite pas encore ce paiement.",
      };
  }
}

/** Webhook placeholder — à brancher en V4 (Stripe/PayPal). */
export async function handlePaymentWebhook(_payload: unknown): Promise<{ handled: boolean }> {
  return { handled: false };
}
