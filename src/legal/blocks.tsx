/**
 * @file src/legal/blocks.tsx
 * @desc The seven legal blocks: plain server-safe React (no hooks) an app drops into its own
 *       legal MDX pages, rendered from a `LegalSite` config instead of hand-written boilerplate.
 *       Semantic HTML only (section, h2, p, ul, a), so it inherits the app's MDX prose styling.
 *       No `@haruhimemoe/ui` dependency: these are plain text blocks, not UI components.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import type { ReactElement } from "react";
import type { LegalSite } from "./types.js";

/** Every block's props: the site config it renders from. */
export type LegalBlockProps = { site: LegalSite };

/**
 * @function LegalContact
 * @param props {LegalBlockProps} the site config
 * @returns {ReactElement} who runs the site and the address for legal questions
 */
export const LegalContact = ({ site }: LegalBlockProps): ReactElement => (
  <section>
    <h2>Contact</h2>
    <p>
      {site.operator} runs {site.siteName}. For anything on this page, write to{" "}
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
    <h2>What we store</h2>
    <ul>
      {site.stores.map((store) => (
        <li key={store.what}>
          <strong>{store.what}.</strong> {store.why}
        </li>
      ))}
    </ul>
    {site.cookies.length > 0 && (
      <>
        <h3>Cookies</h3>
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
    <h2>Service providers</h2>
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
    <h2>Your rights under the GDPR</h2>
    <ul>
      <li>
        <strong>Access and portability.</strong> Get a copy of your data in a machine-readable file.
      </li>
      <li>
        <strong>Rectification.</strong> Have wrong data corrected.
      </li>
      <li>
        <strong>Erasure.</strong> Have your data deleted.
      </li>
      <li>
        <strong>Restriction.</strong> Ask us to pause using your data while a question about it is
        sorted out.
      </li>
      <li>
        <strong>Objection.</strong> Object to anything we do on the basis of legitimate interest.
      </li>
      <li>
        <strong>Complaint.</strong> Complain to your data protection supervisory authority.
      </li>
    </ul>
    <h2>Your rights under the CCPA</h2>
    <ul>
      <li>
        <strong>Know, delete and correct.</strong> Ask what we hold about you, ask us to delete it,
        and ask us to correct it.
      </li>
      <li>
        <strong>Selling and sharing.</strong> We don't sell or share personal information.
      </li>
      <li>
        <strong>Opting out.</strong> We honor Global Privacy Control signals.
      </li>
    </ul>
    <p>
      To use any of these rights, email{" "}
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
    <h2>Copyright and DMCA</h2>
    <p>{site.siteName} hosts no files. See the app's own page for what that means here.</p>
    <p>
      Our designated agent for copyright notices is{" "}
      <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
    </p>
    <h3>A takedown notice should include</h3>
    <ol>
      <li>your contact information;</li>
      <li>the copyrighted work you believe is infringed;</li>
      <li>the URL or page the material appears on;</li>
      <li>a good-faith statement that the use is not authorized;</li>
      <li>a sworn statement that you're the rights holder, or authorized to act for them;</li>
      <li>your physical or electronic signature.</li>
    </ol>
    <h3>A counter-notice should include</h3>
    <ol>
      <li>your contact information;</li>
      <li>the material removed and where it appeared;</li>
      <li>a sworn, good-faith statement that it was removed by mistake or misidentification;</li>
      <li>your consent to the jurisdiction of your local courts, or {site.operator}'s;</li>
      <li>your physical or electronic signature.</li>
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
    <h2>Disclaimer of warranties</h2>
    <p>
      {site.siteName} is provided "as is" and "as available", without warranties of any kind,
      express or implied, including merchantability, fitness for a particular purpose and
      non-infringement.
    </p>
    <h2>Limitation of liability</h2>
    <p>
      To the fullest extent the law allows, {site.operator} is not liable for any indirect,
      incidental, special, consequential or punitive damages, or for any loss of data or accounts,
      arising from your use of {site.siteName}.
    </p>
  </section>
);

/**
 * @function Changes
 * @param props {LegalBlockProps} the site config
 * @returns {ReactElement} the standard "we may update this page" line with its effective date
 */
export const Changes = ({ site }: LegalBlockProps): ReactElement => (
  <section>
    <h2>Changes</h2>
    <p>We may update this page. It was last updated on {site.effectiveDate}.</p>
  </section>
);
