/**
 * @file tests/i18n/negotiate.test.ts
 * @desc hasLocale and negotiateLocale: the saved user locale wins, then Accept-Language in
 *       q-order with a region fallback, then the default; garbage and oversized headers are safe.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { describe, expect, it } from "vitest";
import {
  ACCEPT_LANGUAGE_MAX_ENTRIES,
  DEFAULT_LOCALES,
  hasLocale,
  type LocaleConfig,
  negotiateLocale,
} from "../../src/i18n/index.js";

const CONFIG: LocaleConfig = { locales: ["en", "ja", "pt-BR"], defaultLocale: "en" };

describe("hasLocale", () => {
  it("accepts only exact listed strings", () => {
    expect(DEFAULT_LOCALES).toEqual(["en"]);
    expect(hasLocale(CONFIG, "ja")).toBe(true);
    expect(hasLocale(CONFIG, "JA")).toBe(false);
    expect(hasLocale(CONFIG, null)).toBe(false);
    expect(hasLocale(CONFIG, 1)).toBe(false);
  });
});

describe("negotiateLocale", () => {
  it("prefers the saved user locale when served", () => {
    expect(negotiateLocale(CONFIG, "ja", "pt-BR")).toBe("pt-BR");
    expect(negotiateLocale(CONFIG, "ja", "fr")).toBe("ja");
    expect(negotiateLocale(CONFIG, null, null)).toBe("en");
  });

  it("follows q-values, then header order", () => {
    expect(negotiateLocale(CONFIG, "fr;q=1, en;q=0.5, ja;q=0.8")).toBe("ja");
    expect(negotiateLocale(CONFIG, "ja, en")).toBe("ja");
    expect(negotiateLocale(CONFIG, "en;q=0.9, ja;q=0.9")).toBe("en");
    expect(negotiateLocale(CONFIG, "ja;q=0, en;q=0.1")).toBe("en");
  });

  it("falls back from a region to its language, and matches case-insensitively", () => {
    expect(negotiateLocale(CONFIG, "ja-JP")).toBe("ja");
    expect(negotiateLocale(CONFIG, "pt-br")).toBe("pt-BR");
    expect(negotiateLocale(CONFIG, "fr-FR, *;q=0.1")).toBe("en");
  });

  it("survives garbage", () => {
    for (const header of ["", ";;;", "ja;q=2", "<script>", "ja;q=abc", "a".repeat(5000)]) {
      expect(negotiateLocale(CONFIG, header)).toBe("en");
    }
    expect(negotiateLocale(CONFIG, "x;q=0.5, ja;q=0.4;foo=bar")).toBe("ja");
  });

  it("reads only the first 20 entries and the first 1 KB", () => {
    const filler = Array.from({ length: ACCEPT_LANGUAGE_MAX_ENTRIES }, () => "fr").join(",");
    expect(negotiateLocale(CONFIG, `${filler},ja`)).toBe("en");
    expect(negotiateLocale(CONFIG, `${" ".repeat(1024)},ja`)).toBe("en");
  });
});
