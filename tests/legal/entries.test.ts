/**
 * @file tests/legal/entries.test.ts
 * @desc legalEntries: the five slugs in order, defaults filled from the site config, overrides
 *       merged per field, and the result passing docs' `defineContent` validation unchanged.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { expect, it } from "vitest";
import { defineContent } from "../../src/docs/registry.js";
import { legalEntries } from "../../src/legal/entries.js";
import type { LegalSite } from "../../src/legal/types.js";
import { LEGAL_SLUGS } from "../../src/legal/types.js";

const SITE: LegalSite = {
  siteName: "example.test",
  operator: "Example Co",
  contactEmail: "legal@example.test",
  effectiveDate: "2026-10-05",
  stores: [],
  processors: [],
  cookies: [],
};

it("returns the five slugs in order, dated by the site's effective date", () => {
  const entries = legalEntries(SITE);
  expect(entries.map((entry) => entry.slug)).toEqual(LEGAL_SLUGS);
  for (const entry of entries) expect(entry.lastUpdated).toBe("2026-10-05");
});

it("fills the default descriptions with the site name, and has no em dash", () => {
  const entries = legalEntries(SITE);
  const privacy = entries.find((entry) => entry.slug === "privacy");
  expect(privacy?.description).toContain("example.test");
  for (const entry of entries) {
    expect(entry.title).not.toContain("—");
    expect(entry.description).not.toContain("—");
  }
});

it("merges a per-slug override onto the default, leaving other fields and slugs alone", () => {
  const entries = legalEntries(SITE, {
    privacy: { description: "custom privacy description", lastUpdated: "2026-09-01" },
  });
  const privacy = entries.find((entry) => entry.slug === "privacy");
  expect(privacy).toMatchObject({
    title: "Privacy Policy",
    description: "custom privacy description",
    lastUpdated: "2026-09-01",
  });
  const terms = entries.find((entry) => entry.slug === "terms");
  expect(terms?.lastUpdated).toBe("2026-10-05");
});

it("produces entries defineContent accepts without complaint", () => {
  expect(() => defineContent({ legal: legalEntries(SITE) })).not.toThrow();
});
