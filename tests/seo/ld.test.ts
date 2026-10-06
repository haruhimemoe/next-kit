/**
 * @file tests/seo/ld.test.ts
 * @desc The ld builders' shapes: @context on the graph root only, stable @ids, publisher by @id,
 *       SearchAction, free Offer, positions from 1, ISO dates only when known; and serializeLd
 *       output that can't end a <script> and parses back to the same data.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Tue Oct 6, 2026
 */

import { describe, expect, it } from "vitest";
import { HARUHIME_ORG, type LdNode, ld, serializeLd } from "../../src/seo/index.js";
import { POOLS, WWW } from "./fixture.js";

const ORG_ID = "https://www.haruhime.moe/#organization";

/** Every node in a JSON value, depth first. */
const nodes = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.flatMap(nodes)
    : value && typeof value === "object"
      ? [value as Record<string, unknown>, ...Object.values(value).flatMap(nodes)]
      : [];

describe("site nodes", () => {
  it("puts @context on the graph root only", () => {
    const doc = ld.graph(ld.organization(HARUHIME_ORG), ld.webSite(POOLS));
    expect(doc["@context"]).toBe("https://schema.org");
    expect(nodes(doc["@graph"]).some((node) => "@context" in node)).toBe(false);
  });

  it("builds the Organization with a stable @id and sameAs", () => {
    expect(ld.organization(HARUHIME_ORG)).toEqual({
      "@type": "Organization",
      "@id": ORG_ID,
      name: "haruhime.moe",
      url: "https://www.haruhime.moe",
      logo: "https://www.haruhime.moe/apple-icon.png",
      email: "haruhime@haruhime.moe",
      sameAs: [
        "https://github.com/haruhimemoe",
        "https://haruhime.moe/discord",
        "https://www.npmjs.com/org/haruhimemoe",
      ],
    });
    expect(ld.organization({ name: "x", url: "https://x.example/", sameAs: [] })).toEqual({
      "@type": "Organization",
      "@id": "https://x.example/#organization",
      name: "x",
      url: "https://x.example/",
    });
  });

  it("builds a tool's WebSite with a SearchAction, its publisher and its parent", () => {
    expect(ld.webSite(POOLS, { searchUrlTemplate: "/search?q={search_term_string}" })).toEqual({
      "@type": "WebSite",
      "@id": "https://pools.haruhime.moe/#website",
      name: "pools",
      alternateName: "pools.haruhime.moe",
      url: "https://pools.haruhime.moe/",
      description: POOLS.description,
      inLanguage: "en-US",
      publisher: { "@id": ORG_ID },
      isPartOf: { "@id": "https://www.haruhime.moe/#website" },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: "https://pools.haruhime.moe/search?q={search_term_string}",
        },
        "query-input": "required name=search_term_string",
      },
    });
  });

  it("leaves out isPartOf and the SearchAction when there are none", () => {
    const site = ld.webSite(WWW);
    expect(site).not.toHaveProperty("isPartOf");
    expect(site).not.toHaveProperty("potentialAction");
    expect(site.inLanguage).toBe("en-GB");
  });

  it("refuses a search template without the placeholder", () => {
    expect(() => ld.webSite(POOLS, { searchUrlTemplate: "/search?q=" })).toThrow(
      /search_term_string/,
    );
  });

  it("builds a free WebApplication published by the organization", () => {
    const app = ld.webApplication(POOLS, {
      category: "UtilitiesApplication",
      features: ["Mod-aware map search"],
    });
    expect(app).toMatchObject({
      "@type": "WebApplication",
      "@id": "https://pools.haruhime.moe/#app",
      name: "pools",
      url: "https://pools.haruhime.moe/",
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires JavaScript. Works in any modern browser.",
      featureList: ["Mod-aware map search"],
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@id": ORG_ID },
      isPartOf: { "@id": "https://pools.haruhime.moe/#website" },
    });
  });

  it("gives a sub-tool its own @id and name", () => {
    const app = ld.webApplication(POOLS, {
      name: "collab maker",
      description: "Imagemaps.",
      category: "DesignApplication",
      path: "/collab",
      features: [],
      browserRequirements: "Any browser.",
    });
    expect(app["@id"]).toBe("https://pools.haruhime.moe/collab#app");
    expect(app).not.toHaveProperty("featureList");
    expect(app).toMatchObject({ name: "collab maker", browserRequirements: "Any browser." });
    expect(ld.webApplication(POOLS, { category: "x", path: "/" })["@id"]).toBe(
      "https://pools.haruhime.moe/#app",
    );
  });

  it("numbers breadcrumbs and list items from 1 with absolute URLs", () => {
    const trail = [
      { name: "pools", path: "/" },
      { name: "OWC 2023", path: "/pools/otdb-98" },
    ];
    const crumbs = ld.breadcrumbs(POOLS, trail);
    expect(crumbs.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "pools", item: "https://pools.haruhime.moe/" },
      {
        "@type": "ListItem",
        position: 2,
        name: "OWC 2023",
        item: "https://pools.haruhime.moe/pools/otdb-98",
      },
    ]);
    expect(() => ld.breadcrumbs(POOLS, [])).toThrow(/at least one/);
    const list = ld.itemList(POOLS, trail, { name: "Pools" });
    expect(list).toMatchObject({ "@type": "ItemList", name: "Pools", numberOfItems: 2 });
    expect((list.itemListElement as LdNode[])[1]).toEqual({
      "@type": "ListItem",
      position: 2,
      name: "OWC 2023",
      url: "https://pools.haruhime.moe/pools/otdb-98",
    });
    expect(ld.itemList(POOLS, [])).toEqual({
      "@type": "ItemList",
      numberOfItems: 0,
      itemListElement: [],
    });
  });
});

describe("serializeLd", () => {
  const data = ld.graph(
    ld.faq([{ q: "</script><script>alert(1)</script>", a: "a & b <!-- > \u2028 \u2029" }]),
  );
  const json = serializeLd(data);

  it("escapes everything that could end the script or a comment", () => {
    expect(json).not.toMatch(/[<>&\u2028\u2029]/);
    expect(json).toContain("\\u003c/script\\u003e");
    expect(json).toContain("\\u0026");
    expect(json).toContain("\\u2028");
    expect(json).toContain("\\u2029");
  });

  it("parses back to the same data", () => {
    expect(JSON.parse(json)).toEqual(data);
  });
});
