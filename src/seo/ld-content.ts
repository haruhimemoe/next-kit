/**
 * @file src/seo/ld-content.ts
 * @desc schema.org JSON-LD for content pages: FAQPage, HowTo, TechArticle, CreativeWork and
 *       Dataset. Dates go out as ISO 8601 and only when known (audit A5); the author and
 *       publisher default to the site's organization by @id.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { type LdNode, orgRef } from "./ld-site.js";
import { absoluteUrl, compact, isoDate, type Site } from "./site.js";

/** A person or group credited by name, or a node by @id. */
export type LdAgent = string | { name: string; url?: string } | { "@id": string };

type When = string | Date | null | undefined;

const agent = (value: LdAgent, type = "Person"): Record<string, unknown> =>
  typeof value === "string"
    ? { "@type": type, name: value }
    : "@id" in value
      ? value
      : compact({ "@type": type, name: value.name, url: value.url });

const urls = (site: Site, value?: string | readonly string[]) => {
  if (value === undefined) return undefined;
  const list = (typeof value === "string" ? [value] : [...value]).map((url) =>
    url.startsWith("/") ? absoluteUrl(site, url) : url,
  );
  return list.length === 1 ? list[0] : list;
};

/**
 * @function faq
 * @param items {readonly { q: string; a: string }[]} the questions and their answers, as shown
 * @returns {LdNode} FAQPage with one Question and acceptedAnswer per item
 * @throws {Error} when items is empty
 */
export const faq = (items: readonly { q: string; a: string }[]): LdNode => {
  if (!items.length) throw new Error("seo: a FAQ needs at least one question");
  return {
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
};

/** howTo's input. */
export type HowToOptions = {
  name: string;
  description?: string;
  steps: readonly { name: string; text: string; url?: string }[];
};

/**
 * @function howTo
 * @param options {HowToOptions} the task and its steps, in order
 * @returns {LdNode} HowTo with HowToSteps numbered from 1
 * @throws {Error} when steps is empty
 */
export const howTo = (options: HowToOptions): LdNode => {
  if (!options.steps.length) throw new Error("seo: a HowTo needs at least one step");
  return compact({
    "@type": "HowTo",
    name: options.name,
    description: options.description,
    step: options.steps.map((step, i) =>
      compact({
        "@type": "HowToStep",
        position: i + 1,
        name: step.name,
        text: step.text,
        url: step.url,
      }),
    ),
  });
};

/** techArticle's input. */
export type TechArticleOptions = {
  path: string;
  headline: string;
  description?: string;
  dateModified?: When;
  datePublished?: When;
  /** Defaults to the site's organization. */
  author?: LdAgent;
  /** What the article is about, like "osu! BBCode [imagemap] tag". */
  about?: string;
};

/**
 * @function techArticle
 * @param site {Site} the site
 * @param options {TechArticleOptions} the article
 * @returns {LdNode} TechArticle with url, mainEntityOfPage, publisher and author
 */
export const techArticle = (site: Site, options: TechArticleOptions): LdNode => {
  const url = absoluteUrl(site, options.path);
  return compact({
    "@type": "TechArticle",
    headline: options.headline,
    description: options.description,
    url,
    mainEntityOfPage: url,
    about: options.about,
    datePublished: isoDate(options.datePublished),
    dateModified: isoDate(options.dateModified),
    author: options.author ? agent(options.author) : orgRef(site),
    publisher: orgRef(site),
  });
};

/** creativeWork's input. */
export type CreativeWorkOptions = {
  path: string;
  name: string;
  description?: string;
  author?: LdAgent;
  dateModified?: When;
  /** What it was made from: a path on this site or an absolute URL, or several. */
  isBasedOn?: string | readonly string[];
  numberOfItems?: number;
  genre?: string;
};

/**
 * @function creativeWork
 * @param site {Site} the site
 * @param options {CreativeWorkOptions} the work (a pack, a template, a map page)
 * @returns {LdNode} CreativeWork with url, publisher, and whatever else is known
 */
export const creativeWork = (site: Site, options: CreativeWorkOptions): LdNode =>
  compact({
    "@type": "CreativeWork",
    name: options.name,
    description: options.description,
    url: absoluteUrl(site, options.path),
    author: options.author ? agent(options.author) : undefined,
    dateModified: isoDate(options.dateModified),
    isBasedOn: urls(site, options.isBasedOn),
    numberOfItems: options.numberOfItems,
    genre: options.genre,
    publisher: orgRef(site),
  });

/** dataset's input. */
export type DatasetOptions = {
  path: string;
  name: string;
  /** Google requires 50 to 5000 characters. */
  description: string;
  creator?: LdAgent;
  /** A year or ISO interval, like "2023". */
  temporalCoverage?: string;
  isBasedOn?: string | readonly string[];
  license?: string;
  dateModified?: When;
};

/**
 * @function dataset
 * @param site {Site} the site
 * @param options {DatasetOptions} the dataset (a past tournament pool)
 * @returns {LdNode} Dataset with url, publisher, and creator as an Organization when given
 */
export const dataset = (site: Site, options: DatasetOptions): LdNode =>
  compact({
    "@type": "Dataset",
    name: options.name,
    description: options.description,
    url: absoluteUrl(site, options.path),
    creator: options.creator ? agent(options.creator, "Organization") : undefined,
    temporalCoverage: options.temporalCoverage,
    isBasedOn: urls(site, options.isBasedOn),
    license: options.license,
    dateModified: isoDate(options.dateModified),
    isAccessibleForFree: true,
    publisher: orgRef(site),
  });
