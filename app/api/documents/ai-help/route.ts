import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/documents/rate-limit";
import { getSetting, SETTING_KEYS } from "@/lib/app-settings";

/// Endpoint d'assistance contextuelle alimenté par Claude Haiku.
/// Aide les utilisateurs à comprendre un champ ou un document officiel belge.
///
/// Body : {
///   templateName, organisme?, fieldId?, fieldLabel?, fieldHelp?, question, lang
/// }
///
/// Si ANTHROPIC_API_KEY n'est pas configurée, retourne un message générique.

const SYSTEM_PROMPT_FR = `Tu es un assistant administratif expert des documents et démarches belges (ONEM, CPAS, mutuelles, communes, etc.).

Ton rôle : aider l'utilisateur qui remplit un formulaire officiel belge à comprendre un champ ou une démarche.

Règles strictes :
1. Réponds UNIQUEMENT en français, de façon concise (2-4 phrases max).
2. Si la question concerne un champ spécifique, explique sa signification et donne 1-2 exemples concrets.
3. Si la question est hors-sujet ou personnelle (ex: "réponds à ma place"), refuse poliment.
4. Ne demande JAMAIS d'informations personnelles à l'utilisateur.
5. Si tu ne sais pas, dis-le. Ne devine pas.
6. Pour les références légales, mentionne uniquement celles que tu connais avec certitude.

Format : texte simple, pas de markdown lourd. Tu peux utiliser **gras** pour les mots-clés importants.`;

const SYSTEM_PROMPT_NL = `Je bent een administratieve assistent die expert is in Belgische documenten en procedures (RVA, OCMW, ziekenfondsen, gemeenten, enz.).

Je rol: een gebruiker die een officieel Belgisch formulier invult helpen begrijpen wat een veld of procedure betekent.

Strikte regels:
1. Antwoord ENKEL in het Nederlands, beknopt (max 2-4 zinnen).
2. Bij een veld-vraag: leg de betekenis uit en geef 1-2 concrete voorbeelden.
3. Weiger beleefd off-topic of persoonlijke vragen ("vul voor mij in").
4. Vraag NOOIT persoonlijke informatie.
5. Als je het niet weet, zeg het. Gok niet.
6. Verwijs alleen naar wettelijke referenties die je zeker kent.

Formaat: gewone tekst, geen zware markdown. **Vetgedrukt** mag voor sleutelwoorden.`;

export async function POST(req: NextRequest) {
  // Vérifier que l'aide IA est activée globalement (admin toggle)
  const enabled = await getSetting(SETTING_KEYS.AI_HELP_ENABLED);
  if (enabled !== "true") {
    return NextResponse.json(
      { error: "Aide IA désactivée par l'administrateur" },
      { status: 403 }
    );
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`ai-help:${ip}`, { windowMs: 60_000, max: 10 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes — réessayez dans une minute" },
      { status: 429 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    templateName = "",
    organisme = null,
    fieldId = null,
    fieldLabel = null,
    fieldHelp = null,
    question,
    lang = "fr",
  } = body || {};

  if (!question || typeof question !== "string") {
    return NextResponse.json({ error: "question requise" }, { status: 400 });
  }
  if (question.length > 500) {
    return NextResponse.json({ error: "question trop longue (500 max)" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      reply:
        lang === "nl"
          ? "AI-hulp is niet geconfigureerd op deze installatie. Neem contact op met de beheerder."
          : "L'aide IA n'est pas configurée sur cette installation. Contactez l'administrateur.",
      disabled: true,
    });
  }

  const systemPrompt = lang === "nl" ? SYSTEM_PROMPT_NL : SYSTEM_PROMPT_FR;

  // Contexte : ce que l'utilisateur est en train de remplir
  const contextLines: string[] = [];
  if (templateName) contextLines.push(`Document : ${templateName}`);
  if (organisme) contextLines.push(`Organisme : ${organisme}`);
  if (fieldLabel) contextLines.push(`Champ concerné : « ${fieldLabel} »${fieldId ? ` (id: ${fieldId})` : ""}`);
  if (fieldHelp) contextLines.push(`Aide existante du champ : ${fieldHelp}`);
  const context = contextLines.join("\n");

  const userMessage = context
    ? `Contexte :\n${context}\n\nQuestion de l'utilisateur : ${question}`
    : question;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        // Prompt caching sur le system prompt — économise sur les requêtes répétées
        system: [
          {
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: userMessage }],
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("Anthropic API error:", res.status, errText);
      return NextResponse.json(
        { error: "Erreur de l'assistant IA" },
        { status: 502 }
      );
    }

    const data = await res.json();
    const reply = (data?.content?.[0]?.text || "").trim();
    if (!reply) {
      return NextResponse.json(
        { error: "Réponse IA vide" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      reply,
      usage: {
        inputTokens: data?.usage?.input_tokens,
        outputTokens: data?.usage?.output_tokens,
        cacheRead: data?.usage?.cache_read_input_tokens,
      },
    });
  } catch (err) {
    console.error("AI help error:", err);
    return NextResponse.json(
      { error: "Échec de l'appel IA" },
      { status: 502 }
    );
  }
}
