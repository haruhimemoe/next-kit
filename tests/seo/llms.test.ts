/**
 * @file tests/seo/llms.test.ts
 * @desc llmsTxt in the llmstxt.org shape (H1, blockquote, notes, H2 link lists) with escaped
 *       link text and URLs; llmsFull; textResponse's headers.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { llmsFull, llmsTxt, textResponse } from "../../src/seo/index.js";

describe("llmsTxt", () => {
  it("writes the H1, summary, notes and link sections", () => {
    expect(
      llmsTxt({
        title: "pools.haruhime.moe",
        summary: "Build an osu!\ntournament mappool.",
        notes: ["pools is in beta.", "  "],
        sections: [
          {
            heading: "Pages",
            links: [
              { title: "Home", url: "https://pools.haruhime.moe/", note: "Start here." },
              { title: "Search", url: "https://pools.haruhime.moe/search" },
            ],
          },
          { heading: "Empty", links: [] },
          { heading: "Elsewhere", links: [{ title: "Discord", url: "https://discord.gg/x" }] },
        ],
      }),
    ).toBe(
      [
        "# pools.haruhime.moe",
        "",
        "> Build an osu! tournament mappool.",
        "",
        "pools is in beta.",
        "",
        "## Pages",
        "",
        "- [Home](https://pools.haruhime.moe/): Start here.",
        "- [Search](https://pools.haruhime.moe/search)",
        "",
        "## Elsewhere",
        "",
        "- [Discord](https://discord.gg/x)",
        "",
      ].join("\n"),
    );
  });

  it("escapes brackets in link text and encodes spaces and parens in URLs", () => {
    const out = llmsTxt({
      title: "bb",
      summary: "BBCode.",
      sections: [
        {
          heading: "Tags",
          links: [{ title: "The [b] tag \\ bold", url: "https://bb.example/a b(c)<d>" }],
        },
      ],
    });
    expect(out).toContain("- [The \\[b\\] tag \\\\ bold](https://bb.example/a%20b%28c%29%3Cd%3E)");
  });

  it("refuses a blank title, summary, heading, link title or URL", () => {
    const ok = { title: "t", summary: "s", sections: [] };
    expect(llmsTxt(ok)).toBe("# t\n\n> s\n");
    expect(() => llmsTxt({ ...ok, title: " " })).toThrow(/title/);
    expect(() => llmsTxt({ ...ok, summary: "" })).toThrow(/summary/);
    const link = { title: "a", url: "https://x.example" };
    expect(() => llmsTxt({ ...ok, sections: [{ heading: "", links: [link] }] })).toThrow(/heading/);
    expect(() =>
      llmsTxt({ ...ok, sections: [{ heading: "h", links: [{ ...link, title: "" }] }] }),
    ).toThrow(/link title/);
    expect(() =>
      llmsTxt({ ...ok, sections: [{ heading: "h", links: [{ ...link, url: " " }] }] }),
    ).toThrow(/link URL/);
  });
});

describe("llmsFull", () => {
  it("joins a head and documents with their sources, keeping each document's Markdown", () => {
    expect(
      llmsFull(
        [
          { title: "Make a pack", url: "https://packs.example/guide/a", markdown: "\nStep 1.\n" },
          { title: "Code", markdown: "```\n# not a heading\n```" },
        ],
        { title: "packs guides", summary: "Every guide." },
      ),
    ).toBe(
      [
        "# packs guides",
        "",
        "> Every guide.",
        "",
        "---",
        "",
        "# Make a pack",
        "",
        "Source: https://packs.example/guide/a",
        "",
        "Step 1.",
        "",
        "---",
        "",
        "# Code",
        "",
        "```",
        "# not a heading",
        "```",
        "",
      ].join("\n"),
    );
  });

  it("works without a head or summary", () => {
    expect(llmsFull([{ title: "A", markdown: "a" }])).toBe("# A\n\na\n");
    expect(llmsFull([], { title: "T" })).toBe("# T\n");
    expect(() => llmsFull([{ title: "", markdown: "a" }])).toThrow(/part title/);
  });
});

describe("textResponse", () => {
  it("serves text/plain utf-8 with an hour of public cache by default", async () => {
    const res = textResponse("# hi\n");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600, s-maxage=3600");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await res.text()).toBe("# hi\n");
  });

  it("takes cache lifetimes and a Markdown type", () => {
    const res = textResponse("x", { maxAge: 60, sMaxAge: 86400, type: "text/markdown" });
    expect(res.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("public, max-age=60, s-maxage=86400");
  });
});
