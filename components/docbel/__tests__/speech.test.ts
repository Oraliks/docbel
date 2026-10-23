import { afterEach, describe, expect, it, vi } from "vitest";
import { createSpeechController } from "@/hooks/use-speech";

function setup(initialLanguages = ["fr-BE"]) {
  let voices = initialLanguages.map((lang) => ({ lang })) as SpeechSynthesisVoice[];
  const events = new EventTarget();
  const utterances: SpeechSynthesisUtterance[] = [];
  const engine = {
    cancel: vi.fn(),
    speak: vi.fn((utterance: SpeechSynthesisUtterance) => utterances.push(utterance)),
    getVoices: () => voices,
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  } as unknown as SpeechSynthesis;
  const controller = createSpeechController(() => engine, (text) => ({ text }) as SpeechSynthesisUtterance);
  return {
    controller, engine, utterances,
    voicesChanged(languages: string[]) {
      voices = languages.map((lang) => ({ lang })) as SpeechSynthesisVoice[];
      events.dispatchEvent(new Event("voiceschanged"));
    },
  };
}

afterEach(() => vi.useRealTimers());

describe("public text speech", () => {
  it("speaks supplied text with a compatible voice; active only after onstart", () => {
    const { controller, utterances } = setup();
    controller.speak("question", "Consigne publique", "fr");
    expect(controller.getSnapshot().status).toBe("preparing");
    expect(utterances[0].text).toBe("Consigne publique");
    expect(utterances[0].lang).toBe("fr-BE");
    utterances[0].onstart?.({} as SpeechSynthesisEvent);
    expect(controller.getSnapshot().status).toBe("speaking");
    utterances[0].onend?.({} as SpeechSynthesisEvent);
    expect(controller.getSnapshot().status).toBe("idle");
  });

  it("honors the supplied text language even when other voices are available", () => {
    const { controller, utterances } = setup(["ar-SA", "fr-BE"]);
    controller.speak("question", "Question publique française", "fr");
    expect(utterances[0].lang).toBe("fr-BE");
    controller.stop("question");
  });

  it("waits for asynchronously loaded voices and never speaks twice", () => {
    const { controller, utterances, voicesChanged } = setup([]);
    controller.speak("help", "Explication publique", "ar");
    expect(utterances).toHaveLength(0);
    voicesChanged(["ar-SA", "fr-BE"]);
    voicesChanged(["ar-SA", "fr-BE"]);
    expect(utterances).toHaveLength(1);
    expect(utterances[0].lang).toBe("ar-SA");
    controller.stop("help");
  });

  it("reports absence of a compatible voice instead of reading in another language", () => {
    vi.useFakeTimers();
    const { controller, utterances } = setup(["fr-BE"]);
    controller.speak("help", "Question", "nl");
    vi.advanceTimersByTime(2000);
    expect(controller.getSnapshot().status).toBe("unavailable");
    expect(utterances).toHaveLength(0);
  });

  it("reports browsers without speech synthesis", () => {
    const controller = createSpeechController(() => undefined);
    controller.speak("help", "Question", "fr");
    expect(controller.getSnapshot().status).toBe("unavailable");
  });

  it("new reading cancels the old one and ignores its stale events", () => {
    const { controller, engine, utterances } = setup();
    controller.speak("question", "Question publique", "fr");
    const first = utterances[0];
    first.onstart?.({} as SpeechSynthesisEvent);
    controller.speak("help", "Explication publique", "fr");
    expect(engine.cancel).toHaveBeenCalled();
    first.onend?.({} as SpeechSynthesisEvent);
    expect(controller.getSnapshot()).toEqual({ owner: "help", status: "preparing" });
    controller.stop("question");
    expect(controller.getSnapshot().owner).toBe("help");
    controller.stop("help");
    utterances[1].onstart?.({} as SpeechSynthesisEvent);
    expect(controller.getSnapshot().status).toBe("idle");
  });

  it("cancels a pending voice lookup when leaving its owner", () => {
    vi.useFakeTimers();
    const { controller, voicesChanged, utterances } = setup([]);
    controller.speak("help", "Explication", "fr");
    controller.stop("help");
    voicesChanged(["fr-BE"]);
    vi.runAllTimers();
    expect(utterances).toHaveLength(0);
    expect(controller.getSnapshot().status).toBe("idle");
  });

  it("reports a synthesis error and an engine that never starts", () => {
    vi.useFakeTimers();
    const { controller, utterances, engine } = setup();
    controller.speak("help", "Explication", "fr");
    utterances[0].onerror?.({} as SpeechSynthesisErrorEvent);
    expect(controller.getSnapshot().status).toBe("error");
    controller.speak("help", "Explication", "fr");
    vi.advanceTimersByTime(5000);
    expect(controller.getSnapshot().status).toBe("error");
    expect(engine.cancel).toHaveBeenCalled();
  });
});
