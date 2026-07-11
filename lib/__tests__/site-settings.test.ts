import { describe, it, expect } from "vitest";
import {
  SITE_SETTINGS_DEFAULTS,
  parseSiteSettings,
  deepMergeSettings,
  canonicalUrl,
  isAnnouncementLive,
  announcementTargets,
  toPublicSiteSettings,
  type SiteSettings,
} from "@/lib/site-settings";

describe("parseSiteSettings", () => {
  it("returns a full valid object unchanged (round-trip)", () => {
    const parsed = parseSiteSettings(SITE_SETTINGS_DEFAULTS);
    expect(parsed).toEqual(SITE_SETTINGS_DEFAULTS);
  });

  it("fills missing fields from defaults on a partial object", () => {
    const parsed = parseSiteSettings({ identity: { name: "MonSite" } });
    expect(parsed.identity.name).toBe("MonSite");
    // Reste de identity + autres sections viennent des défauts
    expect(parsed.identity.tagline).toBe(SITE_SETTINGS_DEFAULTS.identity.tagline);
    expect(parsed.seo).toEqual(SITE_SETTINGS_DEFAULTS.seo);
    expect(parsed.maintenance).toEqual(SITE_SETTINGS_DEFAULTS.maintenance);
  });

  it("falls back entirely to defaults on structurally invalid input", () => {
    // name vide viole min(1) → tout l'objet retombe sur les défauts
    expect(parseSiteSettings({ identity: { name: "" } })).toEqual(
      SITE_SETTINGS_DEFAULTS
    );
  });

  it("falls back to defaults on wrong types", () => {
    expect(parseSiteSettings({ maintenance: { enabled: "yes" } })).toEqual(
      SITE_SETTINGS_DEFAULTS
    );
  });

  it("falls back to defaults on null / undefined / garbage", () => {
    expect(parseSiteSettings(null)).toEqual(SITE_SETTINGS_DEFAULTS);
    expect(parseSiteSettings(undefined)).toEqual(SITE_SETTINGS_DEFAULTS);
    expect(parseSiteSettings("not-json")).toEqual(SITE_SETTINGS_DEFAULTS);
    expect(parseSiteSettings(42)).toEqual(SITE_SETTINGS_DEFAULTS);
  });

  it("strips unknown keys not in the schema", () => {
    const parsed = parseSiteSettings({
      identity: { name: "X", surprise: true },
      rogue: 1,
    }) as SiteSettings & { rogue?: unknown };
    expect(parsed.identity.name).toBe("X");
    expect("rogue" in parsed).toBe(false);
    expect("surprise" in parsed.identity).toBe(false);
  });

  it("rejects an out-of-range retentionDays and keeps defaults", () => {
    expect(parseSiteSettings({ legal: { retentionDays: 0 } })).toEqual(
      SITE_SETTINGS_DEFAULTS
    );
  });

  it("accepts a valid nested announcement patch", () => {
    const parsed = parseSiteSettings({
      announcement: { enabled: true, level: "warning", message: "Coucou" },
    });
    expect(parsed.announcement.enabled).toBe(true);
    expect(parsed.announcement.level).toBe("warning");
    expect(parsed.announcement.message).toBe("Coucou");
    // Champs non fournis restent aux défauts
    expect(parsed.announcement.segments).toEqual([]);
  });
});

describe("deepMergeSettings", () => {
  it("merges nested objects without dropping sibling keys", () => {
    const merged = deepMergeSettings(SITE_SETTINGS_DEFAULTS, {
      identity: { name: "Y" },
    });
    expect(merged.identity.name).toBe("Y");
    expect(merged.identity.url).toBe(SITE_SETTINGS_DEFAULTS.identity.url);
  });

  it("replaces arrays wholesale (no element merge)", () => {
    const merged = deepMergeSettings(SITE_SETTINGS_DEFAULTS, {
      announcement: { segments: ["partner"] },
    });
    expect(merged.announcement.segments).toEqual(["partner"]);
  });

  it("ignores undefined values in the patch", () => {
    const merged = deepMergeSettings(SITE_SETTINGS_DEFAULTS, {
      identity: { name: undefined },
    });
    expect(merged.identity.name).toBe(SITE_SETTINGS_DEFAULTS.identity.name);
  });
});

describe("canonicalUrl", () => {
  it("strips trailing slashes", () => {
    expect(canonicalUrl({ identity: { url: "https://x.be/" } as never })).toBe(
      "https://x.be"
    );
    expect(
      canonicalUrl({ identity: { url: "https://x.be///" } as never })
    ).toBe("https://x.be");
  });

  it("falls back to a default domain when empty", () => {
    expect(canonicalUrl({ identity: { url: "" } as never })).toBe(
      "https://docbel.be"
    );
  });
});

describe("isAnnouncementLive", () => {
  const now = new Date("2026-07-11T12:00:00Z");
  const base = SITE_SETTINGS_DEFAULTS.announcement;

  it("is false when disabled", () => {
    expect(isAnnouncementLive({ ...base, enabled: false, message: "x" }, now)).toBe(
      false
    );
  });

  it("is false when message is blank even if enabled", () => {
    expect(isAnnouncementLive({ ...base, enabled: true, message: "  " }, now)).toBe(
      false
    );
  });

  it("is true when enabled, has a message, and no bounds", () => {
    expect(isAnnouncementLive({ ...base, enabled: true, message: "Hi" }, now)).toBe(
      true
    );
  });

  it("respects startsAt / endsAt window", () => {
    const a = { ...base, enabled: true, message: "Hi" };
    expect(
      isAnnouncementLive({ ...a, startsAt: "2026-07-12T00:00:00Z" }, now)
    ).toBe(false); // pas encore commencé
    expect(
      isAnnouncementLive({ ...a, endsAt: "2026-07-10T00:00:00Z" }, now)
    ).toBe(false); // déjà terminé
    expect(
      isAnnouncementLive(
        { ...a, startsAt: "2026-07-10T00:00:00Z", endsAt: "2026-07-12T00:00:00Z" },
        now
      )
    ).toBe(true); // dans la fenêtre
  });

  it("ignores unparseable date bounds", () => {
    const a = { ...base, enabled: true, message: "Hi", startsAt: "pas-une-date" };
    expect(isAnnouncementLive(a, now)).toBe(true);
  });
});

describe("announcementTargets", () => {
  const base = SITE_SETTINGS_DEFAULTS.announcement;

  it("targets everyone when the list is empty", () => {
    expect(announcementTargets({ ...base, segments: [] }, "public")).toBe(true);
    expect(announcementTargets({ ...base, segments: [] }, "partner")).toBe(true);
  });

  it("targets only listed segments otherwise", () => {
    const a = { ...base, segments: ["partner" as const] };
    expect(announcementTargets(a, "partner")).toBe(true);
    expect(announcementTargets(a, "public")).toBe(false);
  });
});

describe("toPublicSiteSettings", () => {
  it("exposes only the client-safe slice (no seo/verification)", () => {
    const pub = toPublicSiteSettings(SITE_SETTINGS_DEFAULTS);
    expect(Object.keys(pub).sort()).toEqual([
      "announcement",
      "consentVersion",
      "identity",
      "maintenance",
    ]);
    expect(pub.consentVersion).toBe(SITE_SETTINGS_DEFAULTS.legal.consentVersion);
    expect("seo" in pub).toBe(false);
  });
});
