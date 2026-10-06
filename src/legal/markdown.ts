/**
 * @file src/legal/markdown.ts
 * @desc `legalMarkdownTransform`: a `mdxToMarkdown` `transforms` entry (see ../docs/markdown.ts)
 *       that turns each self-closing legal block tag (`<LegalContact />`, `<DataWeKeep />`,
 *       `<Processors />`, `<YourRights />`, `<DmcaNotice />`, `<NoWarranty />`, `<Changes />`)
 *       into Markdown carrying the same words as the matching React block in blocks.tsx. Without
 *       this, mdxToMarkdown's rule 4 drops the unknown capitalized JSX and an app's .md mirrors
 *       and llms-full.txt silently lose the legal text. The wording comes from ./copy.js, the
 *       same module blocks.tsx renders from, so the two outputs can't drift apart.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import {
  CCPA_HEADING,
  CCPA_RIGHTS,
  CHANGES_HEADING,
  CONTACT_HEADING,
  COOKIES_HEADING,
  COUNTER_NOTICE_HEADING,
  COUNTER_NOTICE_ITEMS_BEFORE_JURISDICTION,
  COUNTER_NOTICE_SIGNATURE,
  changesParagraph,
  contactIntro,
  counterNoticeJurisdiction,
  DATA_HEADING,
  DMCA_AGENT_INTRO,
  DMCA_HEADING,
  GDPR_HEADING,
  GDPR_RIGHTS,
  type LegalRight,
  LIABILITY_HEADING,
  liabilityParagraph,
  PROCESSORS_HEADING,
  RIGHTS_CLOSING_INTRO,
  TAKEDOWN_HEADING,
  TAKEDOWN_ITEMS,
  WARRANTY_HEADING,
  warrantyParagraph,
} from "./copy.js";
import type { LegalSite } from "./types.js";

/** One attribute on a self-closing tag: `name="value"`, `name='value'`, `name={"value"}` or
 * `name={'value'}`. Only string-literal values are read; a JS expression prop is left alone. */
const ATTR = /([\w-]+)=(?:"([^"]*)"|'([^']*)'|\{"([^"]*)"\}|\{'([^']*)'\})/g;

/** Matches `<Name ...attrs.../>`, tolerating any run of whitespace and any attributes
 * (quoted, single-quoted, braced, or valueless). */
const tagPattern = (name: string): RegExp =>
  new RegExp(`<${name}\\b((?:\\s+[\\w-]+(?:=(?:"[^"]*"|'[^']*'|\\{[^{}]*\\}))?)*)\\s*/>`, "g");

/** Parses a matched tag's attribute string into a name -> value map. */
const attributes = (body: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const match of body.matchAll(ATTR)) {
    out[match[1] as string] = match[2] ?? match[3] ?? match[4] ?? match[5] ?? "";
  }
  return out;
};

/** `${intro}[email](mailto:email).`: an intro sentence plus a Markdown mailto link. */
const mailtoLine = (intro: string, email: string): string => `${intro}[${email}](mailto:${email}).`;

/** One bullet per right, bold term then its plain-text description. */
const rightsList = (rights: readonly LegalRight[]): string =>
  rights.map((right) => `- **${right.term}** ${right.desc}`).join("\n");

/** A numbered list, in source order. */
const orderedList = (items: readonly string[]): string =>
  items.map((item, index) => `${index + 1}. ${item}`).join("\n");

const legalContactMarkdown = (site: LegalSite): string =>
  `## ${CONTACT_HEADING}\n\n${mailtoLine(contactIntro(site), site.contactEmail)}`;

const dataWeKeepMarkdown = (site: LegalSite): string => {
  const stores = site.stores.map((store) => `- **${store.what}.** ${store.why}`).join("\n");
  const cookies =
    site.cookies.length > 0
      ? `\n\n### ${COOKIES_HEADING}\n\n${site.cookies.map((cookie) => `- ${cookie}`).join("\n")}`
      : "";
  return `## ${DATA_HEADING}\n\n${stores}${cookies}`;
};

const processorsMarkdown = (site: LegalSite): string => {
  const list = site.processors
    .map((processor) => {
      const name = processor.link ? `[${processor.name}](${processor.link})` : processor.name;
      return `- **${name}** ${processor.purpose}`;
    })
    .join("\n");
  return `## ${PROCESSORS_HEADING}\n\n${list}`;
};

const yourRightsMarkdown = (site: LegalSite): string =>
  [
    `## ${GDPR_HEADING}`,
    "",
    rightsList(GDPR_RIGHTS),
    "",
    `## ${CCPA_HEADING}`,
    "",
    rightsList(CCPA_RIGHTS),
    "",
    mailtoLine(RIGHTS_CLOSING_INTRO, site.contactEmail),
  ].join("\n");

const dmcaNoticeMarkdown = (site: LegalSite): string =>
  [
    `## ${DMCA_HEADING}`,
    "",
    ...(site.hosting ? [site.hosting, ""] : []),
    mailtoLine(DMCA_AGENT_INTRO, site.contactEmail),
    "",
    `### ${TAKEDOWN_HEADING}`,
    "",
    orderedList(TAKEDOWN_ITEMS),
    "",
    `### ${COUNTER_NOTICE_HEADING}`,
    "",
    orderedList([
      ...COUNTER_NOTICE_ITEMS_BEFORE_JURISDICTION,
      counterNoticeJurisdiction(site),
      COUNTER_NOTICE_SIGNATURE,
    ]),
  ].join("\n");

const noWarrantyMarkdown = (site: LegalSite): string =>
  [
    `## ${WARRANTY_HEADING}`,
    "",
    warrantyParagraph(site),
    "",
    `## ${LIABILITY_HEADING}`,
    "",
    liabilityParagraph(site),
  ].join("\n");

const changesMarkdown = (date: string): string =>
  `## ${CHANGES_HEADING}\n\n${changesParagraph(date)}`;

/** Every block's tag name and Markdown renderer, keyed in the order they're tried. `Changes` is
 * handled separately below so it can read its optional `date` attribute. */
const SIMPLE_BLOCKS: ReadonlyArray<readonly [string, (site: LegalSite) => string]> = [
  ["LegalContact", legalContactMarkdown],
  ["DataWeKeep", dataWeKeepMarkdown],
  ["Processors", processorsMarkdown],
  ["YourRights", yourRightsMarkdown],
  ["DmcaNotice", dmcaNoticeMarkdown],
  ["NoWarranty", noWarrantyMarkdown],
];

/**
 * @function legalMarkdownTransform
 * @param site {LegalSite} the site config every block renders from, same as the React blocks
 * @returns {(source: string) => string} a next-kit `mdxToMarkdown` transform: replaces every
 *   self-closing legal block tag with Markdown carrying the same words as its React block.
 *   `<Changes date="YYYY-MM-DD" />` uses the given date, same as the `Changes` component's `date`
 *   prop; `<Changes />` falls back to `site.effectiveDate`. Every other block takes no attributes.
 */
export const legalMarkdownTransform =
  (site: LegalSite) =>
  (source: string): string => {
    let text = source.replace(tagPattern("Changes"), (_whole, body: string) =>
      changesMarkdown(attributes(body).date ?? site.effectiveDate),
    );
    for (const [name, render] of SIMPLE_BLOCKS) {
      text = text.replace(tagPattern(name), () => render(site));
    }
    return text;
  };
