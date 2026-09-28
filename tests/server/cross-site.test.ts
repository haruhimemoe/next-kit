/**
 * @file tests/server/cross-site.test.ts
 * @desc refuseCrossSite: packs' and pools' cases (tests/unit/lib/api.test.ts), with the site's
 *       URL and name passed in.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { crossSiteMessage, refuseCrossSite } from "../../src/server/index.js";

const SITE = { siteUrl: "https://packs.haruhime.moe", siteTitle: "packs.haruhime.moe" };

const post = (headers: Record<string, string>, url = "http://localhost:3000/api/me/api-key") =>
  new Request(url, { method: "POST", headers });

describe("refuseCrossSite", () => {
  it.each([
    ["no Origin or Sec-Fetch-Site (curl, older browsers)", {}],
    ["the request's own origin", { origin: "http://localhost:3000" }],
    ["the site's origin", { origin: "https://packs.haruhime.moe" }],
    [
      "Sec-Fetch-Site same-origin",
      { origin: "http://localhost:3000", "sec-fetch-site": "same-origin" },
    ],
    ["Sec-Fetch-Site none (typed by the user)", { "sec-fetch-site": "none" }],
  ])("lets through %s", (_, headers) => {
    expect(refuseCrossSite(post(headers), SITE)).toBeNull();
  });

  it.each([
    ["a sibling subdomain's Origin", { origin: "https://pools.haruhime.moe" }],
    ["another site's Origin", { origin: "https://evil.example" }],
    ["Origin null (sandboxed frame)", { origin: "null" }],
    ["the same host over another scheme", { origin: "https://localhost:3000" }],
    ["Sec-Fetch-Site cross-site", { "sec-fetch-site": "cross-site" }],
    ["Sec-Fetch-Site same-site", { "sec-fetch-site": "same-site" }],
  ])("refuses %s with 403", async (_, headers) => {
    const response = refuseCrossSite(post(headers), SITE);
    expect(response?.status).toBe(403);
    expect(await response?.json()).toEqual({
      error: {
        code: "forbidden",
        message: "This request has to come from packs.haruhime.moe itself.",
      },
    });
  });

  it("lets a preview deployment call itself", () => {
    const url = "https://pools-git-x.vercel.app/api/admin/x";
    const request = post({ origin: "https://pools-git-x.vercel.app" }, url);
    expect(refuseCrossSite(request, SITE)).toBeNull();
  });

  it("names the site in the message", () => {
    expect(crossSiteMessage("pools.haruhime.moe")).toBe(
      "This request has to come from pools.haruhime.moe itself.",
    );
  });
});
