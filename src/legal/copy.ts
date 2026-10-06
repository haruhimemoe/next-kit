/**
 * @file src/legal/copy.ts
 * @desc The fixed sentences and list items behind the seven legal blocks (blocks.tsx) and their
 *       Markdown mirror (markdown.ts's `legalMarkdownTransform`), kept in one place so the two
 *       outputs can't drift apart. Pure data and template functions: no JSX, no Markdown syntax,
 *       just the words. Anything that includes a link (the contact email, the DMCA agent email,
 *       the rights-request email) is split into the text before the link so each renderer can
 *       append its own link syntax.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import type { LegalSite } from "./types.js";

/** `LegalContact`'s h2 heading. */
export const CONTACT_HEADING = "Contact";
/** `LegalContact`'s sentence, up to (not including) the contact email link. */
export const contactIntro = (site: LegalSite): string =>
  `${site.operator} runs ${site.siteName}. For anything on this page, write to `;

/** `DataWeKeep`'s h2 heading. */
export const DATA_HEADING = "What we store";
/** `DataWeKeep`'s h3 heading over the cookie list, shown only when `site.cookies` isn't empty. */
export const COOKIES_HEADING = "Cookies";

/** `Processors`'s h2 heading. */
export const PROCESSORS_HEADING = "Service providers";

/** One GDPR or CCPA right: a bold term and its plain-text description. */
export type LegalRight = { term: string; desc: string };

/** `YourRights`'s GDPR section heading. */
export const GDPR_HEADING = "Your rights under the GDPR";
/** `YourRights`'s six GDPR rights, in list order. */
export const GDPR_RIGHTS: readonly LegalRight[] = [
  { term: "Access and portability.", desc: "Get a copy of your data in a machine-readable file." },
  { term: "Rectification.", desc: "Have wrong data corrected." },
  { term: "Erasure.", desc: "Have your data deleted." },
  {
    term: "Restriction.",
    desc: "Ask us to pause using your data while a question about it is sorted out.",
  },
  { term: "Objection.", desc: "Object to anything we do on the basis of legitimate interest." },
  { term: "Complaint.", desc: "Complain to your data protection supervisory authority." },
];
/** `YourRights`'s CCPA section heading. */
export const CCPA_HEADING = "Your rights under the CCPA";
/** `YourRights`'s three CCPA rights, in list order. */
export const CCPA_RIGHTS: readonly LegalRight[] = [
  {
    term: "Know, delete and correct.",
    desc: "Ask what we hold about you, ask us to delete it, and ask us to correct it.",
  },
  { term: "Selling and sharing.", desc: "We don't sell or share personal information." },
  { term: "Opting out.", desc: "We honor Global Privacy Control signals." },
];
/** `YourRights`'s closing sentence, up to (not including) the contact email link. */
export const RIGHTS_CLOSING_INTRO = "To use any of these rights, email ";

/** `DmcaNotice`'s h2 heading. */
export const DMCA_HEADING = "Copyright and DMCA";
/** `DmcaNotice`'s agent sentence, up to (not including) the contact email link. */
export const DMCA_AGENT_INTRO = "Our designated agent for copyright notices is ";
/** `DmcaNotice`'s h3 heading over the takedown-notice list. */
export const TAKEDOWN_HEADING = "A takedown notice should include";
/** `DmcaNotice`'s takedown-notice steps, in list order. */
export const TAKEDOWN_ITEMS: readonly string[] = [
  "your contact information;",
  "the copyrighted work you believe is infringed;",
  "the URL or page the material appears on;",
  "a good-faith statement that the use is not authorized;",
  "a sworn statement that you're the rights holder, or authorized to act for them;",
  "your physical or electronic signature.",
];
/** `DmcaNotice`'s h3 heading over the counter-notice list. */
export const COUNTER_NOTICE_HEADING = "A counter-notice should include";
/** `DmcaNotice`'s counter-notice steps that come before the operator-specific jurisdiction step. */
export const COUNTER_NOTICE_ITEMS_BEFORE_JURISDICTION: readonly string[] = [
  "your contact information;",
  "the material removed and where it appeared;",
  "a sworn, good-faith statement that it was removed by mistake or misidentification;",
];
/** `DmcaNotice`'s jurisdiction step, templated with the site's operator. */
export const counterNoticeJurisdiction = (site: LegalSite): string =>
  `your consent to the jurisdiction of your local courts, or ${site.operator}'s;`;
/** `DmcaNotice`'s final counter-notice step. */
export const COUNTER_NOTICE_SIGNATURE = "your physical or electronic signature.";

/** `NoWarranty`'s "as is" heading. */
export const WARRANTY_HEADING = "Disclaimer of warranties";
/** `NoWarranty`'s "as is" paragraph, templated with the site's name. */
export const warrantyParagraph = (site: LegalSite): string =>
  `${site.siteName} is provided "as is" and "as available", without warranties of any kind, ` +
  `express or implied, including merchantability, fitness for a particular purpose and ` +
  `non-infringement.`;
/** `NoWarranty`'s limitation-of-liability heading. */
export const LIABILITY_HEADING = "Limitation of liability";
/** `NoWarranty`'s limitation-of-liability paragraph, templated with the operator and site name. */
export const liabilityParagraph = (site: LegalSite): string =>
  `To the fullest extent the law allows, ${site.operator} is not liable for any indirect, ` +
  `incidental, special, consequential or punitive damages, or for any loss of data or accounts, ` +
  `arising from your use of ${site.siteName}.`;

/** `Changes`'s h2 heading. */
export const CHANGES_HEADING = "Changes";
/** `Changes`'s full sentence, templated with the page's effective date. */
export const changesParagraph = (date: string): string =>
  `We may update this page. It was last updated on ${date}.`;
