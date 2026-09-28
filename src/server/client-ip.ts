/**
 * @file src/server/client-ip.ts
 * @desc The caller's IP as Vercel reports it (x-real-ip, then the first x-forwarded-for entry),
 *       and the subject every per-IP counter keys on: an IPv4 address whole, an IPv6 address by
 *       its /64, since one host usually gets a whole /64. Vercel's edge overwrites both headers
 *       with the connecting client's IP (it never appends a client-sent value), so neither can be
 *       spoofed in production. That holds only while Vercel is the first hop: behind another
 *       proxy or CDN, both headers carry whatever that hop sends. Byte-identical in packs and
 *       pools (src/utils/client-ip.ts) before it moved here.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

/** Longest IPv6 text is 45 characters; anything longer is junk, and it becomes part of an _id. */
export const MAX_IP_LENGTH = 64;

/**
 * @function clientIp
 * @param headers {Headers} request headers
 * @returns {string} the IP, or "unknown" when neither header has one
 */
export const clientIp = (headers: Headers): string => {
  const real = headers.get("x-real-ip")?.trim();
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (real || forwarded || "unknown").slice(0, MAX_IP_LENGTH);
};

const HEX_GROUP = /^[0-9a-f]{1,4}$/;
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/**
 * @function ipv4Groups
 * @param text {string} a dotted IPv4 address
 * @returns {number[] | null} its two 16-bit groups, or null when it isn't one
 */
const ipv4Groups = (text: string): number[] | null => {
  const octets = IPV4.exec(text)?.slice(1).map(Number);
  if (!octets || octets.some((octet) => octet > 255)) return null;
  const [a = 0, b = 0, c = 0, d = 0] = octets;
  return [(a << 8) | b, (c << 8) | d];
};

/**
 * @function ipv6Groups
 * @param text {string} a lowercase IPv6 address, possibly compressed or ending in dotted IPv4
 * @returns {number[] | null} its eight 16-bit groups, or null when it isn't one
 */
const ipv6Groups = (text: string): number[] | null => {
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const parse = (half: string): number[] | null => {
    if (half === "") return [];
    const parts = half.split(":");
    const groups: number[] = [];
    for (const [index, part] of parts.entries()) {
      if (HEX_GROUP.test(part)) groups.push(Number.parseInt(part, 16));
      else if (index === parts.length - 1 && ipv4Groups(part))
        groups.push(...(ipv4Groups(part) ?? []));
      else return null;
    }
    return groups;
  };
  const head = parse(halves[0] ?? "");
  const tail = halves.length === 2 ? parse(halves[1] ?? "") : [];
  if (!head || !tail) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;
  const missing = 8 - head.length - tail.length;
  return missing >= 1 ? [...head, ...Array<number>(missing).fill(0), ...tail] : null;
};

/**
 * @function rateLimitSubject
 * @param ip {string} what clientIp returned
 * @returns {string} the counter subject: an IPv4 address unchanged; the IPv4 part of an
 *          IPv4-mapped IPv6 address; any other IPv6 address as "g1:g2:g3:g4::/64" (lowercase, no
 *          leading zeros), so every address in one /64 shares a counter; "unknown" and anything
 *          that isn't an address unchanged
 */
export const rateLimitSubject = (ip: string): string => {
  if (!ip.includes(":")) return ip;
  const groups = ipv6Groups(ip.toLowerCase());
  if (!groups) return ip;
  const [g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0, g8 = 0] = groups;
  if (g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0 && g6 === 0xffff) {
    return [g7 >> 8, g7 & 0xff, g8 >> 8, g8 & 0xff].join(".");
  }
  return `${[g1, g2, g3, g4].map((group) => group.toString(16)).join(":")}::/64`;
};
