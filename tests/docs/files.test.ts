/**
 * @file tests/docs/files.test.ts
 * @desc readContentMarkdown and contentFileDrift against a temp content tree: a registered slug
 *       with a file, a registered slug with no file, and a file with no registry entry.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { contentFileDrift, readContentMarkdown } from "../../src/docs/files/index.js";
import { defineContent } from "../../src/docs/index.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "next-kit-docs-"));
  mkdirSync(join(root, "content", "guides"), { recursive: true });
  mkdirSync(join(root, "content", "legal"), { recursive: true });
  writeFileSync(join(root, "content", "guides", "a.mdx"), "Guide A body.\n");
  writeFileSync(join(root, "content", "guides", "stray.mdx"), "Stray body.\n");
  writeFileSync(join(root, "content", "legal", "terms.mdx"), "Terms body.\n");
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const content = defineContent({
  guides: [
    { slug: "a", title: "A", description: "d", lastUpdated: "2026-10-04" },
    { slug: "b", title: "B", description: "d", lastUpdated: "2026-10-04" },
  ],
  legal: [{ slug: "terms", title: "Terms", description: "d", lastUpdated: "2026-10-04" }],
});

describe("contentFileDrift", () => {
  it("finds registered entries missing a file, and files missing a registry entry", () => {
    expect(contentFileDrift(content, { root })).toEqual({
      missingFiles: ["guides/b.mdx"],
      unregistered: ["guides/stray.mdx"],
    });
  });

  it("defaults root to process.cwd()", () => {
    const cwd = process.cwd();
    try {
      process.chdir(root);
      expect(contentFileDrift(content)).toEqual({
        missingFiles: ["guides/b.mdx"],
        unregistered: ["guides/stray.mdx"],
      });
    } finally {
      process.chdir(cwd);
    }
  });

  it("reports no drift against an empty registry and no content dirs", () => {
    const emptyRoot = mkdtempSync(join(tmpdir(), "next-kit-docs-empty-"));
    try {
      expect(contentFileDrift(defineContent({}), { root: emptyRoot })).toEqual({
        missingFiles: [],
        unregistered: [],
      });
    } finally {
      rmSync(emptyRoot, { recursive: true, force: true });
    }
  });
});

describe("readContentMarkdown", () => {
  it("returns converted markdown for a registered, present slug", async () => {
    const result = await readContentMarkdown(content, "guides", "a", {
      root,
      siteUrl: "https://x.haruhime.moe",
    });
    expect(result).toBe("# A\n\nGuide A body.\n");
  });

  it("returns null for an unregistered slug", async () => {
    const result = await readContentMarkdown(content, "guides", "stray", {
      root,
      siteUrl: "https://x.haruhime.moe",
    });
    expect(result).toBeNull();
  });

  it("rejects with ENOENT for a registered slug with no file", async () => {
    await expect(
      readContentMarkdown(content, "guides", "b", { root, siteUrl: "https://x.haruhime.moe" }),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("passes transforms through to mdxToMarkdown", async () => {
    const result = await readContentMarkdown(content, "guides", "a", {
      root,
      siteUrl: "https://x.haruhime.moe",
      transforms: [(source) => source.replace("Guide A body.", "Replaced.")],
    });
    expect(result).toBe("# A\n\nReplaced.\n");
  });
});
