/**
 * @file tests/seo/title.test.ts
 * @desc The short title suffix (audit follow-up): pageTitle's modes, and pageMetadata's "auto"
 *       default switching to the site's shortTitleSuffix only when the full title passes 60.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import {
  notFoundMetadata,
  pageMetadata,
  pageTitle,
  type Site,
  TITLE_MAX,
} from "../../src/seo/index.js";
import { POOLS } from "./fixture.js";

const SHORT: Site = { ...POOLS, shortTitleSuffix: "pools" };
const LONG_NAME = "Nitro+ Tournament 2026 Grand Finals mappool";

describe("pageTitle modes", () => {
  it("defaults to the full suffix", () => {
    expect(pageTitle(SHORT, LONG_NAME)).toBe(`${LONG_NAME} · pools.haruhime.moe`);
  });

  it("forces short, none or full", () => {
    expect(pageTitle(SHORT, "Map", "short")).toBe("Map · pools");
    expect(pageTitle(SHORT, "Map", "none")).toBe("Map");
    expect(pageTitle(SHORT, "Map", "full")).toBe("Map · pools.haruhime.moe");
  });

  it("uses the full suffix for short when the site has no shortTitleSuffix", () => {
    expect(pageTitle(POOLS, "Map", "short")).toBe("Map · pools.haruhime.moe");
    expect(pageTitle(POOLS, LONG_NAME, "auto")).toBe(`${LONG_NAME} · pools.haruhime.moe`);
  });

  it("switches auto to short only past TITLE_MAX", () => {
    expect(TITLE_MAX).toBe(60);
    expect(pageTitle(SHORT, "Search mappools", "auto")).toBe(
      "Search mappools · pools.haruhime.moe",
    );
    expect(pageTitle(SHORT, LONG_NAME, "auto")).toBe(`${LONG_NAME} · pools`);
  });

  it("never adds either suffix twice", () => {
    expect(pageTitle(SHORT, "Map · pools", "full")).toBe("Map · pools");
    expect(pageTitle(SHORT, "Map · pools.haruhime.moe", "short")).toBe("Map · pools.haruhime.moe");
  });
});

describe("pageMetadata titleSuffix", () => {
  it("defaults to auto, in the title, openGraph and twitter alike", () => {
    const meta = pageMetadata(SHORT, { path: "/pools/1", title: LONG_NAME });
    const title = `${LONG_NAME} · pools`;
    expect(meta.title).toEqual({ absolute: title });
    expect((meta.openGraph as { title: string }).title).toBe(title);
    expect((meta.twitter as { title: string }).title).toBe(title);
  });

  it("keeps the full suffix when it fits, and honors a forced mode", () => {
    expect(pageMetadata(SHORT, { path: "/check", title: "Check" }).title).toEqual({
      absolute: "Check · pools.haruhime.moe",
    });
    expect(pageMetadata(SHORT, { path: "/", title: "Check", titleSuffix: "none" }).title).toEqual({
      absolute: "Check",
    });
  });

  it("shortens a long not-found title too", () => {
    const site: Site = { ...SHORT, titleSuffix: "a-very-long-suffix-for-the-test.haruhime.moe" };
    expect(notFoundMetadata(site, "Tournament mappool").title).toEqual({
      absolute: "Tournament mappool not found · pools",
    });
  });
});
