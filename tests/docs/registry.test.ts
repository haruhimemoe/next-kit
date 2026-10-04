/**
 * @file tests/docs/registry.test.ts
 * @desc defineContent's validation and section ordering, and the path and lookup helpers.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import { describe, expect, it } from "vitest";
import {
  contentParams,
  contentPath,
  defineContent,
  findEntry,
  markdownPath,
} from "../../src/docs/index.js";

const entry = (slug: string) => ({
  slug,
  title: slug,
  description: "d",
  lastUpdated: "2026-10-04",
});

describe("defineContent", () => {
  it("keeps non-empty sections in order", () => {
    const c = defineContent({ legal: [entry("terms")], docs: [entry("api")], guides: [] });
    expect(c.sections).toEqual(["docs", "legal"]);
    expect(c.entries.guides).toEqual([]);
  });
  it("rejects bad slugs", () =>
    expect(() => defineContent({ docs: [entry("Bad Slug")] })).toThrow(/slug/));
  it("rejects duplicate slugs", () =>
    expect(() => defineContent({ docs: [entry("a"), entry("a")] })).toThrow(/duplicate/));
  it("rejects bad dates", () =>
    expect(() => defineContent({ docs: [{ ...entry("a"), lastUpdated: "Oct 4" }] })).toThrow(
      /lastUpdated/,
    ));
  it("rejects blank titles", () =>
    expect(() => defineContent({ docs: [{ ...entry("a"), title: " " }] })).toThrow(/title/));
  it("counts a section with only extras", () => {
    const c = defineContent({
      extra: { docs: [{ href: "/docs/tags/b", title: "b", description: "d", group: "Tags" }] },
    });
    expect(c.sections).toEqual(["docs"]);
  });
  it('rejects an extra href that doesn\'t start with "/"', () =>
    expect(() =>
      defineContent({
        extra: { docs: [{ href: "tags/b", title: "b", description: "d", group: "Tags" }] },
      }),
    ).toThrow(/href/));
  it("rejects a duplicate extra href", () => {
    const extra = { href: "/docs/tags/b", title: "b", description: "d", group: "Tags" };
    expect(() => defineContent({ extra: { docs: [extra, extra] } })).toThrow(/duplicate/);
  });
  it("rejects a blank extra title", () =>
    expect(() =>
      defineContent({
        extra: { docs: [{ href: "/docs/tags/b", title: " ", description: "d", group: "Tags" }] },
      }),
    ).toThrow(/title/));
});

describe("paths", () => {
  it("builds paths", () => {
    expect(contentPath("guides", "make-a-pack")).toBe("/guides/make-a-pack");
    expect(markdownPath("legal", "terms")).toBe("/legal/terms.md");
  });
  it("finds entries and params", () => {
    const c = defineContent({ legal: [entry("terms"), entry("privacy")] });
    expect(findEntry(c, "legal", "privacy")?.slug).toBe("privacy");
    expect(findEntry(c, "legal", "nope")).toBeUndefined();
    expect(contentParams(c, "legal")).toEqual([{ slug: "terms" }, { slug: "privacy" }]);
  });
});
