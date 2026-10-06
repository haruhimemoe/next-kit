/**
 * @file src/legal/blocks.tsx
 * @desc The seven legal blocks: plain server-safe React (no hooks) an app drops into its own
 *       legal MDX pages, rendered from a `LegalSite` config instead of hand-written boilerplate.
 *       Semantic HTML only (section, h2, p, ul, a), so it inherits the app's MDX prose styling.
 *       No `@haruhimemoe/ui` dependency: these are plain text blocks, not UI components. The
 *       sentences and list items come from ./copy.js, shared with markdown.ts's
 *       `legalMarkdownTransform` so the two outputs can't drift apart.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import type { ReactElement } from "react";
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

/** Every block's props: the site config it renders from. */
export type LegalBlockProps = { site: LegalSite };

/** `Changes` props: the site config, plus this page's own date when it differs from the site's. */
export type ChangesProps = LegalBlockProps & { date?: string | undefined };

/**
 * @function LegalContact
 * @param props {LegalBlockProps} the site config
 * @returns {ReactElement} who runs the site and the address for legal questions
 */
export const LegalContact = ({ site }: LegalBlockProps): ReactElement => (
  <section>
    <h2>{CONTACT_HEADING}</h2>
    <p>
      {contactIntro(site)}
      <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
    </p>
  </section>
);

/**
 * @function DataWeKeep
 * @param props {LegalBlockProps} the site config
 * @returns {ReactElement} what the app stores and why, plus the cookies it sets
 */
export const DataWeKeep = ({ site }: LegalBlockProps): ReactElement => (
  <section>
    <h2>{DATA_HEADING}</h2>
    <ul>
      {site.stores.map((store) => (
        <li key={store.what}>
          <strong>{store.what}.</strong> {store.why}
        </li>
      ))}
    </ul>
    {site.cookies.length > 0 && (
      <>
        <h3>{COOKIES_HEADING}</h3>
        <ul>
          {site.cookies.map((cookie) => (
            <li key={cookie}>{cookie}</li>
          ))}
        </ul>
      </>
    )}
  </section>
);

/**
 * @function Processors
 * @param props {LegalBlockProps} the site config
 * @returns {ReactElement} the third parties that process data on the app's behalf
 */
export const Processors = ({ site }: LegalBlockProps): ReactElement => (
  <section>
    <h2>{PROCESSORS_HEADING}</h2>
    <ul>
      {site.processors.map((processor) => (
        <li key={processor.name}>
          <strong>
            {processor.link ? <a href={processor.link}>{processor.name}</a> : processor.name}
          </strong>{" "}
          {processor.purpose}
        </li>
      ))}
    </ul>
  </section>
);

/**
 * @function YourRights
 * @param props {LegalBlockProps} the site config
 * @returns {ReactElement} the GDPR and CCPA rights every visitor has, and how to use them
 */
export const YourRights = ({ site }: LegalBlockProps): ReactElement => (
  <section>
    <h2>{GDPR_HEADING}</h2>
    <ul>
      {GDPR_RIGHTS.map((right) => (
        <li key={right.term}>
          <strong>{right.term}</strong> {right.desc}
        </li>
      ))}
    </ul>
    <h2>{CCPA_HEADING}</h2>
    <ul>
      {CCPA_RIGHTS.map((right) => (
        <li key={right.term}>
          <strong>{right.term}</strong> {right.desc}
        </li>
      ))}
    </ul>
    <p>
      {RIGHTS_CLOSING_INTRO}
      <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
    </p>
  </section>
);

/**
 * @function DmcaNotice
 * @param props {LegalBlockProps} the site config
 * @returns {ReactElement} the DMCA agent, and the notice and counter-notice steps
 */
export const DmcaNotice = ({ site }: LegalBlockProps): ReactElement => (
  <section>
    <h2>{DMCA_HEADING}</h2>
    {site.hosting ? <p>{site.hosting}</p> : null}
    <p>
      {DMCA_AGENT_INTRO}
      <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
    </p>
    <h3>{TAKEDOWN_HEADING}</h3>
    <ol>
      {TAKEDOWN_ITEMS.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ol>
    <h3>{COUNTER_NOTICE_HEADING}</h3>
    <ol>
      {COUNTER_NOTICE_ITEMS_BEFORE_JURISDICTION.map((item) => (
        <li key={item}>{item}</li>
      ))}
      <li>{counterNoticeJurisdiction(site)}</li>
      <li>{COUNTER_NOTICE_SIGNATURE}</li>
    </ol>
  </section>
);

/**
 * @function NoWarranty
 * @param props {LegalBlockProps} the site config
 * @returns {ReactElement} the "as is" warranty disclaimer and limitation of liability
 */
export const NoWarranty = ({ site }: LegalBlockProps): ReactElement => (
  <section>
    <h2>{WARRANTY_HEADING}</h2>
    <p>{warrantyParagraph(site)}</p>
    <h2>{LIABILITY_HEADING}</h2>
    <p>{liabilityParagraph(site)}</p>
  </section>
);

/**
 * @function Changes
 * @param props {ChangesProps} the site config and an optional per-page date
 * @returns {ReactElement} the standard "we may update this page" line with its effective date
 */
export const Changes = ({ site, date }: ChangesProps): ReactElement => (
  <section>
    <h2>{CHANGES_HEADING}</h2>
    <p>{changesParagraph(date ?? site.effectiveDate)}</p>
  </section>
);
