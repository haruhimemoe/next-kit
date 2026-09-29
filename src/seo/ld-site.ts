/**
 * @file src/seo/ld-site.ts
 * @desc schema.org JSON-LD for the site itself: the graph wrapper (the only place `@context`
 *       goes), Organization, WebSite with its SearchAction, WebApplication, BreadcrumbList and
 *       ItemList. Stable @ids tie every tool to one organization (audit A3, A6).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { absoluteUrl, compact, nodeId, type Organization, type Site } from "./site.js";

/** One schema.org node, without `@context`. */
export type LdNode = { "@type": string; "@id"?: string; [key: string]: unknown };

/** A JSON-LD document: `@context` once, the nodes in `@graph`. */
export type LdGraph = { "@context": "https://schema.org"; "@graph": LdNode[] };

/** A page named by its path on the site. */
export type LdLink = { name: string; path: string };

/** The placeholder a SearchAction's urlTemplate must hold. */
export const SEARCH_TERM = "{search_term_string}";

/**
 * @function graph
 * @param nodes {LdNode[]} the page's nodes
 * @returns {LdGraph} one JSON-LD document with `@context` on the root only
 */
export const graph = (...nodes: LdNode[]): LdGraph => ({
  "@context": "https://schema.org",
  "@graph": nodes,
});

/**
 * @function organization
 * @param org {Organization} the organization, like HARUHIME_ORG
 * @returns {LdNode} Organization with @id `${origin}/#organization`
 */
export const organization = (org: Organization): LdNode =>
  compact({
    "@type": "Organization",
    "@id": nodeId(org.url, "organization"),
    name: org.name,
    url: org.url,
    logo: org.logo,
    email: org.email,
    sameAs: org.sameAs?.length ? [...org.sameAs] : undefined,
  });

/** A reference to the site's organization by @id. */
export const orgRef = (site: Site): { "@id": string } => ({
  "@id": nodeId(site.organization.url, "organization"),
});

/**
 * @function webSite
 * @param site {Site} the site
 * @param options {{ searchUrlTemplate?: string }} a search URL holding {search_term_string},
 *        like "/search?q={search_term_string}"
 * @returns {LdNode} WebSite with @id `${origin}/#website`, publisher → the organization,
 *          isPartOf → the parent site, and a SearchAction when a template is given
 * @throws {Error} when the template lacks {search_term_string} or isn't on the site
 */
export const webSite = (site: Site, options: { searchUrlTemplate?: string } = {}): LdNode => {
  const template = options.searchUrlTemplate;
  if (template !== undefined && !template.includes(SEARCH_TERM)) {
    throw new Error(`seo: searchUrlTemplate must hold ${SEARCH_TERM}`);
  }
  return compact({
    "@type": "WebSite",
    "@id": nodeId(site.url, "website"),
    name: site.name,
    alternateName: new URL(site.url).host,
    url: absoluteUrl(site, "/"),
    description: site.description,
    inLanguage: (site.locale ?? "en_US").replace("_", "-"),
    publisher: orgRef(site),
    isPartOf: site.parent ? { "@id": nodeId(site.parent.url, "website") } : undefined,
    potentialAction: template
      ? {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: absoluteUrl(site, template) },
          "query-input": "required name=search_term_string",
        }
      : undefined,
  });
};

/** webApplication's input. */
export type WebApplicationOptions = {
  /** Defaults to the site's name. */
  name?: string;
  /** Defaults to the site's description. */
  description?: string;
  /** A schema.org category, like "UtilitiesApplication". */
  category: string;
  features?: readonly string[];
  /** Defaults to "/". A sub-tool (bb's /collab) passes its own path; its @id is then url#app. */
  path?: string;
  /** Default "Requires JavaScript. Works in any modern browser." */
  browserRequirements?: string;
};

/**
 * @function webApplication
 * @param site {Site} the site
 * @param options {WebApplicationOptions} category, and optional name, features and path
 * @returns {LdNode} WebApplication, free (Offer price 0), operatingSystem "Any", publisher →
 *          the organization
 */
export const webApplication = (site: Site, options: WebApplicationOptions): LdNode => {
  const url = absoluteUrl(site, options.path ?? "/");
  return compact({
    "@type": "WebApplication",
    "@id": options.path && options.path !== "/" ? `${url}#app` : nodeId(site.url, "app"),
    name: options.name ?? site.name,
    url,
    description: options.description ?? site.description,
    applicationCategory: options.category,
    operatingSystem: "Any",
    browserRequirements:
      options.browserRequirements ?? "Requires JavaScript. Works in any modern browser.",
    featureList: options.features?.length ? [...options.features] : undefined,
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: orgRef(site),
    isPartOf: { "@id": nodeId(site.url, "website") },
  });
};

/**
 * @function breadcrumbs
 * @param site {Site} the site
 * @param trail {readonly LdLink[]} from the home page down to this page
 * @returns {LdNode} BreadcrumbList, positions from 1, absolute item URLs
 * @throws {Error} when the trail is empty
 */
export const breadcrumbs = (site: Site, trail: readonly LdLink[]): LdNode => {
  if (!trail.length) throw new Error("seo: breadcrumbs need at least one page");
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((link, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: link.name,
      item: absoluteUrl(site, link.path),
    })),
  };
};

/**
 * @function itemList
 * @param site {Site} the site
 * @param items {readonly LdLink[]} the listed pages, in order
 * @param options {{ name?: string }} the list's name
 * @returns {LdNode} ItemList with numberOfItems and ListItems (position, name, url)
 */
export const itemList = (
  site: Site,
  items: readonly LdLink[],
  options: { name?: string } = {},
): LdNode =>
  compact({
    "@type": "ItemList",
    name: options.name,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: absoluteUrl(site, item.path),
    })),
  });
