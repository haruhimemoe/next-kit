/**
 * @file tests/docs/crawl.test.ts
 * @desc contentLlmsTxt's section order (Docs, Guides, API, Legal) and omission of empty ones,
 *       contentLlmsFull's heading strip and read order, contentSitemap's per-section paths, and
 *       contentRewrites's one fixed rule.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import { describe, expect, it, vi } from "vitest";
import {
  contentLlmsFull,
  contentLlmsTxt,
  contentRewrites,
  contentSitemap,
} from "../../src/docs/crawl.js";
import { defineContent } from "../../src/docs/index.js";
import type { Site } from "../../src/seo/index.js";

const SITE: Site = {
  name: "x",
  url: "https://x.haruhime.moe",
  title: "x",
  description: "x.",
  ogImages: [],
  organization: { name: "x", url: "https://x.haruhime.moe" },
};

const content = defineContent({
  docs: [
    {
      slug: "api",
      title: "API Reference",
      description: "The REST API.",
      lastUpdated: "2026-10-01",
    },
  ],
  legal: [{ slug: "terms", title: "Terms", description: "The terms.", lastUpdated: "2026-10-02" }],
});

describe("contentLlmsTxt", () => {
  it("writes Docs, API and Legal, skipping Guides, which has no entries", () => {
    const out = contentLlmsTxt({
      site: SITE,
      title: "x.haruhime.moe",
      summary: "x's tools.",
      content,
      api: [{ title: "OpenAPI", url: "https://x.haruhime.moe/api/v1/openapi.json" }],
    });
    expect(out).toBe(
      [
        "# x.haruhime.moe",
        "",
        "> x's tools.",
        "",
        "## Docs",
        "",
        "- [API Reference](https://x.haruhime.moe/docs/api.md): The REST API.",
        "",
        "## API",
        "",
        "- [OpenAPI](https://x.haruhime.moe/api/v1/openapi.json)",
        "",
        "## Legal",
        "",
        "- [Terms](https://x.haruhime.moe/legal/terms.md): The terms.",
        "",
      ].join("\n"),
    );
    expect(out).not.toContain("## Guides");
    expect(out.indexOf("## API")).toBeLessThan(out.indexOf("## Legal"));
  });

  it("omits the API section too when no api entries are given", () => {
    const out = contentLlmsTxt({ site: SITE, title: "t", summary: "s", content });
    expect(out).not.toContain("## API");
  });

  it("writes notes and an api link's note when given", () => {
    const out = contentLlmsTxt({
      site: SITE,
      title: "t",
      summary: "s",
      notes: ["In beta."],
      content: defineContent({}),
      api: [{ title: "OpenAPI", url: "https://x.haruhime.moe/x.json", note: "The schema." }],
    });
    expect(out).toContain("In beta.");
    expect(out).toContain("- [OpenAPI](https://x.haruhime.moe/x.json): The schema.");
  });

  it("links extras to markdownHref when set, else href", () => {
    const withExtra = defineContent({
      docs: [{ slug: "api", title: "API", description: "d", lastUpdated: "2026-10-01" }],
      extra: {
        docs: [
          { href: "/docs/tags/b", title: "Tag B", description: "d2", group: "Tags" },
          {
            href: "/docs/tags/c",
            markdownHref: "/docs/tags/c.md",
            title: "Tag C",
            description: "d3",
            group: "Tags",
          },
        ],
      },
    });
    const out = contentLlmsTxt({ site: SITE, title: "t", summary: "s", content: withExtra });
    expect(out).toContain("- [Tag B](https://x.haruhime.moe/docs/tags/b): d2");
    expect(out).toContain("- [Tag C](https://x.haruhime.moe/docs/tags/c.md): d3");
  });
});

describe("contentLlmsFull", () => {
  it("strips the leading H1 from each read result, reads in section order, and places before/after", async () => {
    const read = vi.fn(
      async (section: string, slug: string) => `# Ignored\n\nBody of ${section}/${slug}.\n`,
    );
    const out = await contentLlmsFull({
      site: SITE,
      title: "x full",
      content,
      read,
      before: [{ title: "Intro", markdown: "Welcome." }],
      after: [{ title: "Footer", markdown: "Bye." }],
    });
    expect(read).toHaveBeenCalledTimes(2);
    expect(read.mock.calls).toEqual([
      ["docs", "api"],
      ["legal", "terms"],
    ]);
    expect(out).toBe(
      [
        "# x full",
        "",
        "---",
        "",
        "# Intro",
        "",
        "Welcome.",
        "",
        "---",
        "",
        "# API Reference",
        "",
        "Source: https://x.haruhime.moe/docs/api",
        "",
        "Body of docs/api.",
        "",
        "---",
        "",
        "# Terms",
        "",
        "Source: https://x.haruhime.moe/legal/terms",
        "",
        "Body of legal/terms.",
        "",
        "---",
        "",
        "# Footer",
        "",
        "Bye.",
        "",
      ].join("\n"),
    );
    expect(out.match(/# API Reference/g)).toHaveLength(1);
  });

  it("works with no before/after and no summary", async () => {
    const out = await contentLlmsFull({
      site: SITE,
      title: "t",
      content: defineContent({}),
      read: async () => "# X\n\nY\n",
    });
    expect(out).toBe("# t\n");
  });

  it("writes the summary when given", async () => {
    const out = await contentLlmsFull({
      site: SITE,
      title: "t",
      summary: "Every doc.",
      content: defineContent({}),
      read: async () => "# X\n\nY\n",
    });
    expect(out).toBe("# t\n\n> Every doc.\n");
  });
});

describe("contentSitemap", () => {
  it("lists each non-empty section's index, entries and extras, and no empty section", () => {
    const out = contentSitemap(content);
    expect(out.map((record) => record.path)).toEqual([
      "/docs",
      "/docs/api",
      "/legal",
      "/legal/terms",
    ]);
  });

  it("sets the section index's lastModified to the newest lastUpdated in it", () => {
    const multi = defineContent({
      docs: [
        { slug: "a", title: "A", description: "d", lastUpdated: "2026-01-01" },
        { slug: "b", title: "B", description: "d", lastUpdated: "2026-10-04" },
      ],
    });
    const out = contentSitemap(multi);
    expect(out[0]).toEqual({ path: "/docs", lastModified: "2026-10-04" });
    expect(out[1]).toEqual({ path: "/docs/a", lastModified: "2026-01-01" });
    expect(out[2]).toEqual({ path: "/docs/b", lastModified: "2026-10-04" });
  });

  it("omits lastModified from the section index when nothing dates it", () => {
    const extraOnly = defineContent({
      extra: { docs: [{ href: "/docs/tags/b", title: "b", description: "d", group: "Tags" }] },
    });
    expect(contentSitemap(extraOnly)).toEqual([{ path: "/docs" }, { path: "/docs/tags/b" }]);
  });

  it("includes an extra's lastModified only when it has one", () => {
    const withExtras = defineContent({
      docs: [{ slug: "a", title: "A", description: "d", lastUpdated: "2026-01-01" }],
      extra: {
        docs: [
          { href: "/docs/tags/b", title: "b", description: "d", group: "Tags" },
          {
            href: "/docs/tags/c",
            title: "c",
            description: "d",
            group: "Tags",
            lastUpdated: "2026-05-05",
          },
        ],
      },
    });
    const out = contentSitemap(withExtras);
    expect(out).toEqual([
      { path: "/docs", lastModified: "2026-05-05" },
      { path: "/docs/a", lastModified: "2026-01-01" },
      { path: "/docs/tags/b" },
      { path: "/docs/tags/c", lastModified: "2026-05-05" },
    ]);
  });
});

describe("contentRewrites", () => {
  it("returns exactly one rewrite rule for docs, guides and legal markdown mirrors", () => {
    expect(contentRewrites()).toEqual([
      {
        source: "/:section(docs|guides|legal)/:slug([a-z0-9-]+).md",
        destination: "/:section/:slug/md",
      },
    ]);
  });
});
