/**
 * @file src/auth/session-cookie.ts
 * @desc The signed better-auth session cookie, read without better-auth: find it (secure
 *       prefix first) and verify its HMAC-SHA256 signature in constant time. Split from
 *       session-reader.ts.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** A canonical base64 HMAC-SHA256: 43 chars and one "=" pad, as better-call's makeSignature
 * writes it and its getSignedCookie requires. */
const SIGNATURE_PATTERN = /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/;

const parseCookieHeader = (header: string): Map<string, string> => {
  const cookies = new Map<string, string>();
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    // First one wins, same as better-call's parseCookies.
    if (!name || cookies.has(name)) continue;
    cookies.set(name, part.slice(index + 1).trim());
  }
  return cookies;
};

/**
 * @function findSessionCookie
 * @param headers {Headers} request headers
 * @param cookieName {string} better-auth's base cookie name
 * @returns {{ name: string; value: string } | null} the cookie's name and raw value, trying
 *          the bare name and the __Secure-/__Host- prefixed ones (whichever better-auth's own secureCookiePrefix picked), secure first
 */
export const findSessionCookie = (
  headers: Headers,
  cookieName: string,
): { name: string; value: string } | null => {
  const header = headers.get("cookie");
  if (!header) return null;
  const cookies = parseCookieHeader(header);
  // The __Secure- name first: it's the one better-auth sets on https, and a stale or planted
  // bare-name cookie must not shadow it.
  for (const name of [`__Secure-${cookieName}`, `__Host-${cookieName}`, cookieName]) {
    const value = cookies.get(name);
    if (value !== undefined) return { name, value };
  }
  return null;
};

/**
 * @function verifySignedToken
 * @param value {string} the cookie's decoded value, `${token}.${signature}`
 * @param secret {string} BETTER_AUTH_SECRET
 * @returns {string | null} the token when its signature (HMAC-SHA256, base64, over the token
 *          alone) matches, compared in constant time; null otherwise. A session token never
 *          contains ".", so the last "." splits token from signature.
 */
export const verifySignedToken = (value: string, secret: string): string | null => {
  const separator = value.lastIndexOf(".");
  if (separator <= 0 || separator === value.length - 1) return null;
  const token = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  // better-call's getSignedCookie only accepts a canonical 44-char padded base64 signature.
  // Buffer.from(…, "base64") is lenient (skips bad chars, takes base64url), so check the shape
  // first or non-canonical signatures would verify here and fail on the hub.
  if (!SIGNATURE_PATTERN.test(signature)) return null;
  const expected = createHmac("sha256", secret).update(token).digest();
  const given = Buffer.from(signature, "base64");
  if (given.length !== expected.length) return null;
  return timingSafeEqual(given, expected) ? token : null;
};
