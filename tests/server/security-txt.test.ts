/**
 * @file tests/server/security-txt.test.ts
 * @desc buildSecurityTxt: the cases packs and pools both had (tests/unit/utils/security-txt.test.ts),
 *       with the site's values passed in.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import {
  buildSecurityTxt,
  SECURITY_TXT_LIFETIME_DAYS,
  SECURITY_TXT_PATH,
} from "../../src/server/index.js";

const SITE = {
  contactEmail: "contact@haruhime.moe",
  siteUrl: "https://pools.haruhime.moe",
  policyUrl: "https://github.com/haruhimemoe/pools.haruhime.moe/blob/main/SECURITY.md",
};
const NOW = new Date("2026-09-23T00:00:00.000Z");

describe("buildSecurityTxt", () => {
  it("writes the five fields in order", () => {
    expect(buildSecurityTxt({ ...SITE, now: NOW })).toBe(
      [
        "Contact: mailto:contact@haruhime.moe",
        "Expires: 2027-09-23T00:00:00.000Z",
        "Preferred-Languages: en",
        "Canonical: https://pools.haruhime.moe/.well-known/security.txt",
        "Policy: https://github.com/haruhimemoe/pools.haruhime.moe/blob/main/SECURITY.md",
        "",
      ].join("\n"),
    );
    expect(SECURITY_TXT_PATH).toBe("/.well-known/security.txt");
  });

  it("expires exactly 365 days after now, in ISO 8601 UTC", () => {
    const now = new Date("2028-02-29T13:45:10.123Z");
    const expires = buildSecurityTxt({ ...SITE, now }).match(/^Expires: (.+)$/m)?.[1] ?? "";
    expect(SECURITY_TXT_LIFETIME_DAYS).toBe(365);
    expect(expires).toBe(new Date(now.getTime() + 365 * 86_400_000).toISOString());
    expect(expires).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("ends with exactly one newline", () => {
    const text = buildSecurityTxt({ ...SITE, now: NOW });
    expect(text.endsWith("\n")).toBe(true);
    expect(text.endsWith("\n\n")).toBe(false);
  });
});

describe("buildSecurityTxt contactUrl", () => {
  it("puts the URL contact first", () => {
    const lines = buildSecurityTxt({
      ...SITE,
      now: NOW,
      contactUrl: "https://github.com/x/security",
    }).split("\n");
    expect(lines[0]).toBe("Contact: https://github.com/x/security");
    expect(lines[1]).toBe("Contact: mailto:contact@haruhime.moe");
  });

  it("is unchanged without it", () => {
    expect(buildSecurityTxt({ ...SITE, now: NOW }).split("\n")[0]).toBe(
      "Contact: mailto:contact@haruhime.moe",
    );
  });
});
