/**
 * @file src/server/cross-site.ts
 * @desc The same-origin guard every cookie-authenticated write runs: a request whose Origin is
 *       neither its own nor the site's, or whose Sec-Fetch-Site says cross-site or same-site (a
 *       sibling *.haruhime.moe host is another site here), gets a 403. Moved from pools
 *       (src/lib/api.ts); the site's URL and name come from the caller.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { jsonError } from "./errors.js";

/** Sec-Fetch-Site values that mean another site (or a sibling host) sent the request. */
const FOREIGN_FETCH_SITES: ReadonlySet<string> = new Set(["cross-site", "same-site"]);

/** refuseCrossSite's options. */
export type CrossSiteOptions = {
  /** The site's canonical URL; its origin is allowed besides the request's own. */
  siteUrl: string;
  /** The site's name, for the 403 message. */
  siteTitle: string;
};

/**
 * @function crossSiteMessage
 * @param siteTitle {string} the site's name
 * @returns {string} the 403 message refuseCrossSite sends
 */
export const crossSiteMessage = (siteTitle: string): string =>
  `This request has to come from ${siteTitle} itself.`;

/**
 * @function refuseCrossSite
 * @param request {Request} a cookie-authenticated mutation
 * @param options {CrossSiteOptions} the site's URL and name
 * @returns {Response | null} 403 forbidden when Origin is present and isn't the request's own
 *          origin or the site's, or when Sec-Fetch-Site says cross-site or same-site; otherwise
 *          null
 */
export const refuseCrossSite = (
  request: Request,
  { siteUrl, siteTitle }: CrossSiteOptions,
): Response | null => {
  const origin = request.headers.get("origin");
  const ownOrigin = new URL(request.url).origin;
  const siteOrigin = new URL(siteUrl).origin;
  const foreignOrigin = origin !== null && origin !== ownOrigin && origin !== siteOrigin;
  const fetchSite = request.headers.get("sec-fetch-site");
  const foreignFetch = fetchSite !== null && FOREIGN_FETCH_SITES.has(fetchSite);
  return foreignOrigin || foreignFetch ? jsonError(403, crossSiteMessage(siteTitle)) : null;
};
