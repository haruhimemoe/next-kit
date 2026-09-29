/**
 * @file tests/seo/describe.test.ts
 * @desc clampDescription: short text passes through on one line; long text is cut at a word,
 *       never over max, with "…" and no dangling punctuation; one long word is cut mid-word.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { clampDescription, DESCRIPTION_MAX } from "../../src/seo/index.js";

describe("clampDescription", () => {
  it("keeps short text, on one line", () => {
    expect(clampDescription("  Build a\n  pool.  ")).toBe("Build a pool.");
    expect(clampDescription("")).toBe("");
  });

  it("keeps text exactly max long", () => {
    const text = "a".repeat(DESCRIPTION_MAX);
    expect(clampDescription(text)).toBe(text);
  });

  it("cuts at the last whole word and adds …, within max", () => {
    const text = `${"word ".repeat(40)}end`;
    const out = clampDescription(text);
    expect(out.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(out).toMatch(/word…$/);
    expect(out).not.toMatch(/ …$/);
  });

  it("drops trailing commas, colons, dashes and brackets before the …", () => {
    expect(clampDescription("alpha beta, gamma", 12)).toBe("alpha beta…");
    expect(clampDescription("alpha: beta gamma", 10)).toBe("alpha…");
    expect(clampDescription("alpha — beta gamma", 10)).toBe("alpha…");
    expect(clampDescription("alpha (beta gamma", 8)).toBe("alpha…");
  });

  it("uses a word that ends exactly at the limit", () => {
    expect(clampDescription("abcd efgh ijkl", 10)).toBe("abcd efgh…");
  });

  it("cuts one long word mid-word", () => {
    expect(clampDescription("abcdefghijkl", 5)).toBe("abcd…");
  });

  it("keeps the cut when it is nothing but punctuation", () => {
    expect(clampDescription("... more", 5)).toBe("...…");
  });

  it("refuses a max under 2 or not an integer", () => {
    expect(() => clampDescription("x", 1)).toThrow(RangeError);
    expect(() => clampDescription("x", 2.5)).toThrow(RangeError);
  });
});
