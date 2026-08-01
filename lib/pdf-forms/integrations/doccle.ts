// Adapter Doccle (envoi sécurisé de documents, Belgique). STUB : prêt à
// câbler dès réception des accès API Doccle. Permet de NE PAS stocker le PDF
// généré côté beldoc (RGPD) : on le pousse directement vers la boîte Doccle
// de l'utilisateur.
//
// Env requis pour activer :
//   DOCCLE_API_BASE_URL
//   DOCCLE_API_KEY        (ou client_id/secret selon le contrat)
//   DOCCLE_SENDER_ID      (identifiant émetteur Doccle)
//
// Docs : https://www.doccle.be/  (API partenaire — accès sur demande)

/// Doccle est-il proposable au citoyen ?
///
/// Renvoie `false` tant que `sendToDoccle` est un stub qui lève : sans ce
/// garde, il suffisait de poser les deux variables d'environnement pour voir
/// apparaître le choix « Envoyer via Doccle » à l'écran… et récolter un 502 au
/// moment d'envoyer un document officiel. Couper ici plutôt que dans le runner
/// ferme les DEUX portes d'un coup — l'affichage de l'option (page document) et
/// la garde de la route de génération s'appuient tous deux sur cette fonction.
///
/// À rétablir en même temps que l'implémentation réelle : décommenter la ligne
/// ci-dessous et retirer le `false`.
export function isDoccleConfigured(): boolean {
  return false;
  // return !!(process.env.DOCCLE_API_BASE_URL && process.env.DOCCLE_API_KEY);
}

export interface DoccleRecipient {
  /// Identifiant du destinataire chez Doccle. Selon le contrat : NISS, email
  /// vérifié, ou identifiant Doccle. À préciser à l'intégration.
  reference: string;
  email?: string;
}

export interface DoccleSendInput {
  recipient: DoccleRecipient;
  filename: string;
  pdf: Buffer;
  /// Métadonnées d'affichage côté Doccle.
  title: string;
  issuer?: string;
}

export interface DoccleSendResult {
  /// Identifiant du document chez Doccle (preuve d'envoi, pas de PII).
  documentId: string;
  status: "delivered" | "queued";
}

/// Envoie un document généré vers Doccle. STUB : la requête réseau réelle
/// dépend du contrat API. La signature est stable pour que la route de
/// génération puisse déjà l'appeler.
export async function sendToDoccle(_input: DoccleSendInput): Promise<DoccleSendResult> {
  if (!isDoccleConfigured()) {
    throw new Error("Doccle non configuré — envoi indisponible");
  }
  // TODO(doccle): POST {DOCCLE_API_BASE_URL}/documents (multipart : métadonnées
  //               + binaire PDF), authent via DOCCLE_API_KEY. Mapper la réponse
  //               vers DoccleSendResult. Ne jamais persister le PDF côté beldoc.
  throw new Error("Doccle: envoi non encore implémenté (accès en attente)");
}
