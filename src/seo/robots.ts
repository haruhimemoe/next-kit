/**
 * @file src/seo/robots.ts
 * @desc robots.txt with the AI stance written down (audit A1). A crawler that matches a named
 *       group ignores the `*` group (RFC 9309), so every allowed AI bot gets a group with the same
 *       rules as `*`, and a blocked one gets `Disallow: /`. Changing the stance is one word.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { MetadataRoute } from "next";
import { absoluteUrl, origin, type Site } from "./site.js";

/** What a bot fetches for: model training, or search and answers (user fetches included). */
export type AiBotKind = "training" | "search";

/** One AI or search crawler, by its robots.txt user-agent token. */
export type AiBot = {
  userAgent: string;
  operator: string;
  kind: AiBotKind;
  /** A web search engine's own crawler: "block-all" keeps it, or the site leaves that engine. */
  searchEngine?: true;
};

/** The crawlers robots() names. Order is the order their groups list them. */
export const AI_BOTS: readonly AiBot[] = [
  { userAgent: "GPTBot", operator: "OpenAI", kind: "training" },
  { userAgent: "OAI-SearchBot", operator: "OpenAI", kind: "search" },
  { userAgent: "ChatGPT-User", operator: "OpenAI", kind: "search" },
  { userAgent: "PerplexityBot", operator: "Perplexity", kind: "search" },
  { userAgent: "Perplexity-User", operator: "Perplexity", kind: "search" },
  { userAgent: "ClaudeBot", operator: "Anthropic", kind: "training" },
  { userAgent: "Claude-SearchBot", operator: "Anthropic", kind: "search" },
  { userAgent: "Claude-User", operator: "Anthropic", kind: "search" },
  { userAgent: "anthropic-ai", operator: "Anthropic", kind: "training" },
  { userAgent: "Google-Extended", operator: "Google", kind: "training" },
  { userAgent: "Applebot-Extended", operator: "Apple", kind: "training" },
  { userAgent: "Bingbot", operator: "Microsoft", kind: "search", searchEngine: true },
  { userAgent: "CCBot", operator: "Common Crawl", kind: "training" },
  { userAgent: "Bytespider", operator: "ByteDance", kind: "training" },
  { userAgent: "meta-externalagent", operator: "Meta", kind: "training" },
];

/** The AI stance: allow every bot, block training only, or block every AI bot. */
export type AiBotsPolicy = "allow" | "block-training" | "block-all";

/** robots()'s options. */
export type RobotsOptions = {
  /** Paths every crawler may fetch. Default ["/"]. */
  allow?: readonly string[];
  /** Private paths, like "/api/" or "/admin". Longest match wins over allow. */
  disallow?: readonly string[];
  /** Default "allow". */
  aiBots?: AiBotsPolicy;
};

const blocked = (bot: AiBot, policy: AiBotsPolicy): boolean =>
  policy === "block-all"
    ? !bot.searchEngine
    : policy === "block-training" && bot.kind === "training";

/**
 * @function robots
 * @param site {Site} the site (sitemap and host come from its origin)
 * @param options {RobotsOptions} allow, disallow and the AI stance
 * @returns {MetadataRoute.Robots} the `*` group, one group for the allowed AI bots with the same
 *          rules (Bingbot is always there), one `Disallow: /` group for the blocked ones (when
 *          any are), the sitemap URL and the host
 */
export const robots = (site: Site, options: RobotsOptions = {}): MetadataRoute.Robots => {
  const policy = options.aiBots ?? "allow";
  const allow = [...(options.allow ?? ["/"])];
  const rules = { allow, ...(options.disallow?.length ? { disallow: [...options.disallow] } : {}) };
  const allowed = AI_BOTS.filter((bot) => !blocked(bot, policy)).map((bot) => bot.userAgent);
  const denied = AI_BOTS.filter((bot) => blocked(bot, policy)).map((bot) => bot.userAgent);
  return {
    rules: [
      { userAgent: "*", ...rules },
      { userAgent: allowed, ...rules },
      ...(denied.length ? [{ userAgent: denied, disallow: "/" }] : []),
    ],
    sitemap: absoluteUrl(site, "/sitemap.xml"),
    host: origin(site.url),
  };
};
