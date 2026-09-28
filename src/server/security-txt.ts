/**
 * @file src/server/security-txt.ts
 * @desc /.well-known/security.txt (RFC 9116): where to report a vulnerability, when the file goes
 *       stale (a year after it was built, so a deploy rebuilds it), and the policy. Byte-identical
 *       in packs and pools (src/utils/security-txt.ts), which read their SITE constants; the
 *       caller passes them here.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

/** RFC 9116 asks for an Expires less than a year out. */
export const SECURITY_TXT_LIFETIME_DAYS = 365;

/** Where the file is served. */
export const SECURITY_TXT_PATH = "/.well-known/security.txt";

/** buildSecurityTxt's input. */
export type SecurityTxtOptions = {
  /** Where to report, as an email address (becomes a mailto: Contact). */
  contactEmail: string;
  /** The site's origin, like https://pools.haruhime.moe (no trailing slash). */
  siteUrl: string;
  /** The security policy, like the repo's SECURITY.md. */
  policyUrl: string;
  /** When the file is built (build time for a static route). */
  now: Date;
};

/**
 * @function buildSecurityTxt
 * @param options {SecurityTxtOptions} contact, site, policy and build time
 * @returns {string} the security.txt body: Contact, Expires, Preferred-Languages, Canonical,
 *          Policy, one field per line, ending in one newline
 */
export const buildSecurityTxt = ({
  contactEmail,
  siteUrl,
  policyUrl,
  now,
}: SecurityTxtOptions): string => {
  const expires = new Date(now.getTime() + SECURITY_TXT_LIFETIME_DAYS * 86_400_000);
  const lines = [
    `Contact: mailto:${contactEmail}`,
    `Expires: ${expires.toISOString()}`,
    "Preferred-Languages: en",
    `Canonical: ${siteUrl}${SECURITY_TXT_PATH}`,
    `Policy: ${policyUrl}`,
  ];
  return `${lines.join("\n")}\n`;
};
