/**
 * POST /api/chomage-ia/voice/transcribe
 *
 * Reçoit un fichier audio en multipart (`audio`) et le proxie vers Whisper
 * (OpenAI) pour transcription. Renvoie `{ text: "..." }`.
 *
 * - Auth admin requise.
 * - Si `OPENAI_API_KEY` est absente → 503 "Whisper non configuré".
 * - Limite client : 25 Mo (limite native de Whisper).
 * - Rate limit : 3 req/min par IP — Whisper n'est pas gratuit et un click
 *   accidentel sur le bouton micro ne doit pas spam la facture.
 * - Modèle : `whisper-1` (le seul modèle de l'endpoint `/audio/transcriptions`
 *   au 2026-05). Note : OpenAI annonce `gpt-4o-mini-transcribe` mais il
 *   utilise un endpoint séparé (`/audio/transcriptions` sur le modèle
 *   `gpt-4o-mini-transcribe`) — on reste sur whisper-1 pour stabilité.
 * - Langue : "fr" (Belgique francophone primary). On pourrait laisser Whisper
 *   détecter, mais le forcer améliore la précision sur les termes techniques
 *   ("préavis", "ONEM", "intempéries", etc.).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { getSetting, SETTING_KEYS } from "@/lib/app-settings";

/** Limite serveur = 25 Mo (limite hard de Whisper). */
const MAX_BYTES = 25 * 1024 * 1024;

/** Modèle Whisper. Aujourd'hui le seul modèle stable de cet endpoint. */
const WHISPER_MODEL = "whisper-1";

/** Langue forcée pour améliorer la précision sur les termes belges chômage. */
const WHISPER_LANGUAGE = "fr";

/** Endpoint OpenAI Whisper. */
const OPENAI_TRANSCRIPTIONS_URL =
  "https://api.openai.com/v1/audio/transcriptions";

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  // Feature désactivée par défaut côté admin — l'admin doit l'activer
  // explicitement dans /admin/documents/settings (nécessite OPENAI_API_KEY).
  const voiceEnabled = await getSetting(SETTING_KEYS.CHOMAGE_IA_VOICE_ENABLED);
  if (voiceEnabled !== "true") {
    return NextResponse.json(
      {
        error:
          "Voice input désactivé. Active-le dans /admin/documents/settings (onglet IA Chômage).",
      },
      { status: 503 }
    );
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit(`chomage-ia:voice:transcribe:${ip}`, {
    windowMs: 60_000,
    max: 3,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de transcriptions — réessayez dans une minute" },
      { status: 429 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Whisper non configuré sur ce serveur (variable OPENAI_API_KEY absente)",
      },
      { status: 503 }
    );
  }

  // Parse le multipart : on attend un champ `audio` qui contient le Blob.
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Body invalide — multipart attendu" },
      { status: 400 }
    );
  }

  const audio = formData.get("audio");
  if (!(audio instanceof Blob)) {
    return NextResponse.json(
      { error: "Champ 'audio' manquant ou invalide" },
      { status: 400 }
    );
  }

  if (audio.size === 0) {
    return NextResponse.json(
      { error: "Fichier audio vide" },
      { status: 400 }
    );
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error: `Fichier trop volumineux (${Math.round(audio.size / 1024 / 1024)} Mo > 25 Mo max)`,
      },
      { status: 413 }
    );
  }

  // Détermine le filename à envoyer à Whisper : OpenAI utilise l'extension du
  // filename pour deviner le format. On force `.webm` qui couvre 99 % des
  // captures browser, sauf si le mimeType pointe vers du mp4/m4a.
  let filename = "audio.webm";
  const mime = audio.type || "";
  if (mime.includes("mp4") || mime.includes("m4a")) filename = "audio.m4a";
  else if (mime.includes("ogg")) filename = "audio.ogg";
  else if (mime.includes("wav")) filename = "audio.wav";
  else if (mime.includes("mpeg") || mime.includes("mp3")) filename = "audio.mp3";

  // Construit le multipart à renvoyer à Whisper.
  const whisperForm = new FormData();
  whisperForm.append("file", audio, filename);
  whisperForm.append("model", WHISPER_MODEL);
  whisperForm.append("language", WHISPER_LANGUAGE);
  whisperForm.append("response_format", "json");

  let whisperRes: Response;
  try {
    whisperRes = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: whisperForm,
      // Timeout via AbortController : 90s max (audio long = transcription longue)
      signal: AbortSignal.timeout(90_000),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: msg.includes("aborted")
          ? "Timeout de transcription Whisper (90s)"
          : `Erreur réseau vers Whisper : ${msg}`,
      },
      { status: 502 }
    );
  }

  if (!whisperRes.ok) {
    let detail = "";
    try {
      const errBody = await whisperRes.json();
      detail = errBody?.error?.message || errBody?.error || "";
    } catch {
      detail = await whisperRes.text().catch(() => "");
    }
    return NextResponse.json(
      {
        error: `Whisper a renvoyé ${whisperRes.status}${detail ? ` — ${detail}` : ""}`,
      },
      { status: 502 }
    );
  }

  let payload: { text?: string };
  try {
    payload = (await whisperRes.json()) as { text?: string };
  } catch {
    return NextResponse.json(
      { error: "Réponse Whisper invalide (JSON malformé)" },
      { status: 502 }
    );
  }

  const text = (payload.text || "").trim();
  if (!text) {
    return NextResponse.json(
      { error: "Whisper n'a rien retourné — réessaie en parlant plus fort" },
      { status: 200 }
    );
  }

  return NextResponse.json({ text });
}
