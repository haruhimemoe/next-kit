/**
 * @file tests/seo/fixture.ts
 * @desc A pools-like Site and a bare one, for the seo tests.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { HARUHIME_ORG, type Site } from "../../src/seo/index.js";

/** A tool site with a parent, twitter handles and one preview image. */
export const POOLS: Site = {
  name: "pools",
  url: "https://pools.haruhime.moe",
  title: "osu! tournament mappool builder",
  description:
    "Build an osu! tournament mappool: search every ranked map under HR or DT, check the content rules, see where each map was played, then download it as a pack.",
  twitter: { site: "@haruhimemoe", creator: "@dvhsh" },
  ogImages: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "pools" }],
  organization: HARUHIME_ORG,
  parent: { name: "haruhime.moe", url: "https://www.haruhime.moe" },
};

/** The parent site: a custom suffix, a locale, no twitter, no parent, a bare organization. */
export const WWW: Site = {
  name: "haruhime.moe",
  url: "https://www.haruhime.moe/",
  title: "osu! tools for players, mappers and tournament hosts",
  titleSuffix: "haruhime.moe",
  description: "haruhime's osu! tools.",
  locale: "en_GB",
  ogImages: [],
  organization: { name: "haruhime.moe", url: "https://www.haruhime.moe" },
};
