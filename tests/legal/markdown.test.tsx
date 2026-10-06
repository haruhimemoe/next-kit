/**
 * @file tests/legal/markdown.test.tsx
 * @desc For every legal block, `legalMarkdownTransform`'s Markdown reads, after stripping
 *       Markdown syntax, the same as the plain text of the matching React block in blocks.tsx.
 *       Covers both the plain config and the optional fields (hosting, empty cookies, a
 *       processor without a link, Changes with and without its own date).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  Changes,
  DataWeKeep,
  DmcaNotice,
  LegalContact,
  NoWarranty,
  Processors,
  YourRights,
} from "../../src/legal/blocks.js";
import { legalMarkdownTransform } from "../../src/legal/markdown.js";
import type { LegalSite } from "../../src/legal/types.js";

afterEach(cleanup);

const SITE: LegalSite = {
  siteName: "example.test",
  operator: "Example Co",
  contactEmail: "legal@example.test",
  effectiveDate: "2026-10-05",
  stores: [{ what: "account id", why: "to know who signed in" }],
  processors: [{ name: "Vercel", purpose: "hosts the site", link: "https://vercel.com" }],
  cookies: ["session, HttpOnly, keeps you signed in"],
};

/** The direct-child text lines of a legal block's rendered `<section>`: one entry per heading,
 * paragraph or list item, each with internal whitespace collapsed. Mirrors how `markdownLines`
 * reads a Markdown block, so the two can be compared line for line. */
const blockLines = (container: HTMLElement): string[] => {
  const lines: string[] = [];
  const text = (el: Element): string => (el.textContent ?? "").replace(/\s+/g, " ").trim();
  const walk = (el: Element) => {
    if (el.tagName === "UL" || el.tagName === "OL") {
      for (const li of Array.from(el.children)) lines.push(text(li));
      return;
    }
    if (el.tagName === "H2" || el.tagName === "H3" || el.tagName === "P") {
      lines.push(text(el));
      return;
    }
    for (const child of Array.from(el.children)) walk(child);
  };
  walk(container);
  return lines.filter((line) => line.length > 0);
};

/** A Markdown block's lines, with heading hashes, list markers, bold and link syntax stripped
 * back to plain words, one entry per non-blank line. */
const markdownLines = (markdown: string): string[] =>
  markdown
    .split("\n")
    .map((line) =>
      line
        .replace(/^#{1,6}\s+/, "")
        .replace(/^\d+\.\s+/, "")
        .replace(/^-\s+/, "")
        .replace(/\*\*/g, "")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .trim(),
    )
    .filter((line) => line.length > 0);

/** Renders a block and converts its tag through `legalMarkdownTransform`, then asserts their
 * lines match exactly. */
const expectSameWords = (tag: string, site: LegalSite, element: ReactElement) => {
  const { container } = render(element);
  const transformed = legalMarkdownTransform(site)(`<${tag} />`);
  expect(markdownLines(transformed)).toEqual(blockLines(container));
};

describe("legalMarkdownTransform", () => {
  it("matches LegalContact", () => {
    expectSameWords("LegalContact", SITE, <LegalContact site={SITE} />);
  });

  it("matches DataWeKeep, cookies included", () => {
    expectSameWords("DataWeKeep", SITE, <DataWeKeep site={SITE} />);
  });

  it("matches DataWeKeep, cookies empty", () => {
    const site = { ...SITE, cookies: [] };
    expectSameWords("DataWeKeep", site, <DataWeKeep site={site} />);
  });

  it("matches Processors, every entry linked", () => {
    expectSameWords("Processors", SITE, <Processors site={SITE} />);
  });

  it("matches Processors, one entry without a link", () => {
    const site = {
      ...SITE,
      processors: [
        { name: "Vercel", purpose: "hosts the site", link: "https://vercel.com" },
        { name: "MongoDB Atlas", purpose: "stores the data" },
      ],
    };
    expectSameWords("Processors", site, <Processors site={site} />);
  });

  it("matches YourRights", () => {
    expectSameWords("YourRights", SITE, <YourRights site={SITE} />);
  });

  it("matches DmcaNotice, no hosting line", () => {
    expectSameWords("DmcaNotice", SITE, <DmcaNotice site={SITE} />);
  });

  it("matches DmcaNotice, with a hosting line", () => {
    const site = { ...SITE, hosting: "Users upload nothing." };
    expectSameWords("DmcaNotice", site, <DmcaNotice site={site} />);
  });

  it("matches NoWarranty", () => {
    expectSameWords("NoWarranty", SITE, <NoWarranty site={SITE} />);
  });

  it("matches Changes, site's own effective date", () => {
    expectSameWords("Changes", SITE, <Changes site={SITE} />);
  });

  it("matches Changes, a page-specific date", () => {
    const { container } = render(<Changes site={SITE} date="2026-09-01" />);
    const transformed = legalMarkdownTransform(SITE)('<Changes date="2026-09-01" />');
    expect(markdownLines(transformed)).toEqual(blockLines(container));
  });

  it("tolerates surrounding whitespace and leaves the rest of the source alone", () => {
    const source = "Intro line.\n\n<LegalContact   />\n\nOutro line.";
    const transformed = legalMarkdownTransform(SITE)(source);
    expect(transformed).toContain("Intro line.");
    expect(transformed).toContain("Outro line.");
    expect(transformed).not.toContain("<LegalContact");
  });
});
