/**
 * @file tests/seo/robots.test.ts
 * @desc robots: the `*` group, an allowed-AI group with the same rules (a named group replaces
 *       `*` for that bot), a Disallow: / group per the stance, the sitemap and host; AI_BOTS tags.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { AI_BOTS, robots } from "../../src/seo/index.js";
import { POOLS, WWW } from "./fixture.js";

const names = (kind?: "training" | "search") =>
  AI_BOTS.filter((bot) => !kind || bot.kind === kind).map((bot) => bot.userAgent);

describe("AI_BOTS", () => {
  it("lists every named crawler once, tagged training or search", () => {
    expect(new Set(names()).size).toBe(AI_BOTS.length);
    for (const ua of [
      "GPTBot",
      "OAI-SearchBot",
      "ChatGPT-User",
      "PerplexityBot",
      "Perplexity-User",
      "ClaudeBot",
      "Claude-SearchBot",
      "Claude-User",
      "anthropic-ai",
      "Google-Extended",
      "Applebot-Extended",
      "Bingbot",
      "CCBot",
      "Bytespider",
      "meta-externalagent",
    ]) {
      expect(names(), ua).toContain(ua);
    }
    expect(names("training")).toEqual(expect.arrayContaining(["GPTBot", "CCBot", "ClaudeBot"]));
    expect(names("search")).toEqual(expect.arrayContaining(["OAI-SearchBot", "Claude-User"]));
  });
});

describe("robots", () => {
  it("allows everything by default, with the AI bots named, the sitemap and the host", () => {
    expect(robots(WWW)).toEqual({
      rules: [
        { userAgent: "*", allow: ["/"] },
        { userAgent: names(), allow: ["/"] },
      ],
      sitemap: "https://www.haruhime.moe/sitemap.xml",
      host: "https://www.haruhime.moe",
    });
  });

  it("gives the allowed AI bots the same private-path rules as *", () => {
    const out = robots(POOLS, { allow: ["/", "/api/openapi.json"], disallow: ["/api/", "/admin"] });
    const rules = { allow: ["/", "/api/openapi.json"], disallow: ["/api/", "/admin"] };
    expect(out.rules).toEqual([
      { userAgent: "*", ...rules },
      { userAgent: names(), ...rules },
    ]);
  });

  it("blocks training bots only with block-training", () => {
    const out = robots(POOLS, { disallow: ["/admin"], aiBots: "block-training" });
    expect(out.rules).toEqual([
      { userAgent: "*", allow: ["/"], disallow: ["/admin"] },
      { userAgent: names("search"), allow: ["/"], disallow: ["/admin"] },
      { userAgent: names("training"), disallow: "/" },
    ]);
  });

  it("blocks every AI bot but the search engine crawler with block-all", () => {
    const out = robots(POOLS, { aiBots: "block-all" });
    expect(out.rules).toEqual([
      { userAgent: "*", allow: ["/"] },
      { userAgent: ["Bingbot"], allow: ["/"] },
      { userAgent: names().filter((ua) => ua !== "Bingbot"), disallow: "/" },
    ]);
  });

  it("leaves an empty disallow list out", () => {
    expect(robots(POOLS, { disallow: [] }).rules).toEqual([
      { userAgent: "*", allow: ["/"] },
      { userAgent: names(), allow: ["/"] },
    ]);
  });
});
