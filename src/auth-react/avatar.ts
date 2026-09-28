/**
 * @file src/auth-react/avatar.ts
 * @desc Where an osu! avatar is shown from. osu!'s API sends a.ppy.sh URLs, and the guest avatar
 *       on osu.ppy.sh (which osu-web can send as a bare path). An app's CSP and next/image
 *       config allow those two hosts, so any other URL shows no avatar rather than a broken one.
 *       Pure and browser-safe. Moved from pools and bb (src/utils/avatar.ts, identical).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

/** osu!'s avatar hosts. */
export const OSU_AVATAR_HOSTS: ReadonlySet<string> = new Set(["a.ppy.sh", "osu.ppy.sh"]);

/** A bare path is osu-web's own. */
const OSU_WEB = "https://osu.ppy.sh";

/**
 * @function osuAvatarSrc
 * @param url {string | null | undefined} the avatar URL osu! sent
 * @returns {string | null} it on https when it's on a.ppy.sh or osu.ppy.sh (a bare path read as
 *          osu.ppy.sh's), else null
 */
export const osuAvatarSrc = (url: string | null | undefined): string | null => {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url, OSU_WEB);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (!OSU_AVATAR_HOSTS.has(parsed.hostname) || parsed.port !== "") return null;
  parsed.protocol = "https:";
  return parsed.href;
};
