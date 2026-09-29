/**
 * @file tests/seo/ld-content.test.ts
 * @desc FAQPage, HowTo, TechArticle, CreativeWork and Dataset: required fields, the author and
 *       publisher defaults, isBasedOn resolution, and dates only when known.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { ld } from "../../src/seo/index.js";
import { POOLS } from "./fixture.js";

const ORG = { "@id": "https://www.haruhime.moe/#organization" };

describe("faq", () => {
  it("builds one Question with an accepted Answer per item", () => {
    expect(ld.faq([{ q: "Is it free?", a: "Yes." }])).toEqual({
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Is it free?",
          acceptedAnswer: { "@type": "Answer", text: "Yes." },
        },
      ],
    });
    expect(() => ld.faq([])).toThrow(/at least one/);
  });
});

describe("howTo", () => {
  it("numbers the steps from 1 and keeps optional fields out when missing", () => {
    expect(
      ld.howTo({
        name: "Make a pack",
        description: "From IDs to a zip.",
        steps: [
          { name: "Paste", text: "Paste IDs." },
          { name: "Download", text: "Press Download.", url: "https://packs.haruhime.moe/new" },
        ],
      }),
    ).toEqual({
      "@type": "HowTo",
      name: "Make a pack",
      description: "From IDs to a zip.",
      step: [
        { "@type": "HowToStep", position: 1, name: "Paste", text: "Paste IDs." },
        {
          "@type": "HowToStep",
          position: 2,
          name: "Download",
          text: "Press Download.",
          url: "https://packs.haruhime.moe/new",
        },
      ],
    });
    expect(ld.howTo({ name: "x", steps: [{ name: "a", text: "b" }] })).not.toHaveProperty(
      "description",
    );
    expect(() => ld.howTo({ name: "x", steps: [] })).toThrow(/at least one/);
  });
});

describe("techArticle", () => {
  it("defaults author and publisher to the organization and writes ISO dates", () => {
    expect(
      ld.techArticle(POOLS, {
        path: "/docs/tags/b",
        headline: "osu! [b] tag",
        description: "Bold.",
        about: "osu! BBCode [b] tag",
        dateModified: "2026-09-28",
        datePublished: undefined,
      }),
    ).toEqual({
      "@type": "TechArticle",
      headline: "osu! [b] tag",
      description: "Bold.",
      url: "https://pools.haruhime.moe/docs/tags/b",
      mainEntityOfPage: "https://pools.haruhime.moe/docs/tags/b",
      about: "osu! BBCode [b] tag",
      dateModified: "2026-09-28T00:00:00.000Z",
      author: ORG,
      publisher: ORG,
    });
  });

  it("takes a named or linked author", () => {
    expect(ld.techArticle(POOLS, { path: "/a", headline: "A", author: "haruhime" }).author).toEqual(
      { "@type": "Person", name: "haruhime" },
    );
    const linked = ld.techArticle(POOLS, {
      path: "/a",
      headline: "A",
      author: { name: "haruhime", url: "https://www.haruhime.moe" },
    });
    expect(linked.author).toEqual({
      "@type": "Person",
      name: "haruhime",
      url: "https://www.haruhime.moe",
    });
  });
});

describe("creativeWork", () => {
  it("resolves isBasedOn paths, keeps absolute URLs, and drops unknown dates", () => {
    const work = ld.creativeWork(POOLS, {
      path: "/p/abc",
      name: "OWC 2023 QF",
      description: "13 maps.",
      author: { "@id": "https://www.haruhime.moe/#person" },
      dateModified: "not a date",
      isBasedOn: ["/pools/otdb-98", "https://osu.ppy.sh/wiki/en/Tournaments/OWC/2023"],
      numberOfItems: 13,
      genre: "Tournament",
    });
    expect(work).toEqual({
      "@type": "CreativeWork",
      name: "OWC 2023 QF",
      description: "13 maps.",
      url: "https://pools.haruhime.moe/p/abc",
      author: { "@id": "https://www.haruhime.moe/#person" },
      isBasedOn: [
        "https://pools.haruhime.moe/pools/otdb-98",
        "https://osu.ppy.sh/wiki/en/Tournaments/OWC/2023",
      ],
      numberOfItems: 13,
      genre: "Tournament",
      publisher: ORG,
    });
  });

  it("writes one isBasedOn as a string and leaves out what's missing", () => {
    const work = ld.creativeWork(POOLS, { path: "/t/x", name: "x", isBasedOn: "/pools/1" });
    expect(work.isBasedOn).toBe("https://pools.haruhime.moe/pools/1");
    expect(Object.keys(work).sort()).toEqual(["@type", "isBasedOn", "name", "publisher", "url"]);
  });
});

describe("dataset", () => {
  it("builds a free Dataset with an Organization creator", () => {
    expect(
      ld.dataset(POOLS, {
        path: "/pools/otdb-98",
        name: "osu! World Cup 2023 Qualifiers mappool",
        description: "The 13 maps of the osu! World Cup 2023 Qualifiers, with star ratings.",
        creator: "osu! World Cup 2023",
        temporalCoverage: "2023",
        isBasedOn: "https://otdb.example/98",
        license: "https://creativecommons.org/licenses/by/4.0/",
        dateModified: new Date("2026-09-27T23:06:05.927Z"),
      }),
    ).toEqual({
      "@type": "Dataset",
      name: "osu! World Cup 2023 Qualifiers mappool",
      description: "The 13 maps of the osu! World Cup 2023 Qualifiers, with star ratings.",
      url: "https://pools.haruhime.moe/pools/otdb-98",
      creator: { "@type": "Organization", name: "osu! World Cup 2023" },
      temporalCoverage: "2023",
      isBasedOn: "https://otdb.example/98",
      license: "https://creativecommons.org/licenses/by/4.0/",
      dateModified: "2026-09-27T23:06:05.927Z",
      isAccessibleForFree: true,
      publisher: ORG,
    });
    expect(ld.dataset(POOLS, { path: "/pools/1", name: "x", description: "y" })).not.toHaveProperty(
      "creator",
    );
  });
});
