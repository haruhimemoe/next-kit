/**
 * @file tests/auth/discord.test.ts
 * @desc The Discord link's config and state: null config when either env var is missing, the
 *       authorize URL, and the state refused when tampered, mismatched, wrong-length, expired
 *       or from the future.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { describe, expect, it } from "vitest";
import {
  DISCORD_STATE_TTL_SECONDS,
  discordAuthorizeUrl,
  discordLinkConfig,
  newDiscordState,
  readCookie,
  signDiscordState,
  verifyDiscordState,
} from "../../src/auth/discord.js";

const SECRET = "s".repeat(32);
const NOW = Date.parse("2026-10-06T12:00:00.000Z");
const USER = "6520f0c2a1b2c3d4e5f60718";

describe("discordLinkConfig", () => {
  it("is null when either env var is missing or blank", () => {
    expect(discordLinkConfig({}, "https://www.haruhime.moe")).toBeNull();
    expect(discordLinkConfig({ DISCORD_CLIENT_ID: "1" }, "https://www.haruhime.moe")).toBeNull();
    expect(
      discordLinkConfig({ DISCORD_CLIENT_ID: " ", DISCORD_CLIENT_SECRET: "x" }, "https://a.b"),
    ).toBeNull();
  });

  it("derives the redirect URI from the hub URL", () => {
    expect(
      discordLinkConfig(
        { DISCORD_CLIENT_ID: "123", DISCORD_CLIENT_SECRET: "shh" },
        "https://www.haruhime.moe/",
      ),
    ).toEqual({
      clientId: "123",
      clientSecret: "shh",
      redirectUri: "https://www.haruhime.moe/api/account/discord/callback",
    });
  });
});

describe("discordAuthorizeUrl", () => {
  it("asks for identify with prompt=none and the state", () => {
    const url = new URL(
      discordAuthorizeUrl(
        { clientId: "123", clientSecret: "x", redirectUri: "https://h/cb" },
        "st",
      ),
    );
    expect(url.origin + url.pathname).toBe("https://discord.com/oauth2/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: "123",
      scope: "identify",
      redirect_uri: "https://h/cb",
      state: "st",
      prompt: "none",
    });
  });
});

describe("state", () => {
  const state = newDiscordState();
  const cookie = signDiscordState(SECRET, state, USER, NOW);

  it("makes 32 random bytes", () => {
    expect(Buffer.from(state, "base64url")).toHaveLength(32);
    expect(newDiscordState()).not.toBe(state);
  });

  it("verifies a good state and gives the user", () => {
    expect(verifyDiscordState(SECRET, cookie, state, NOW + 1000)).toBe(USER);
  });

  it("refuses a tampered cookie or another secret", () => {
    const [s, , issued, mac] = cookie.split(".");
    const other = `${s}.${"0".repeat(24)}.${issued}.${mac}`;
    expect(verifyDiscordState(SECRET, other, state, NOW)).toBeNull();
    expect(verifyDiscordState("t".repeat(32), cookie, state, NOW)).toBeNull();
    expect(verifyDiscordState(SECRET, `${cookie}x`, state, NOW)).toBeNull();
    expect(verifyDiscordState(SECRET, "a.b.c", state, NOW)).toBeNull();
    expect(verifyDiscordState(SECRET, null, state, NOW)).toBeNull();
  });

  it("refuses a query state that doesn't match, or has another length", () => {
    expect(verifyDiscordState(SECRET, cookie, newDiscordState(), NOW)).toBeNull();
    expect(verifyDiscordState(SECRET, cookie, state.slice(1), NOW)).toBeNull();
    expect(verifyDiscordState(SECRET, cookie, null, NOW)).toBeNull();
  });

  it("refuses an expired or future state", () => {
    const late = NOW + DISCORD_STATE_TTL_SECONDS * 1000 + 1;
    expect(verifyDiscordState(SECRET, cookie, state, late)).toBeNull();
    expect(verifyDiscordState(SECRET, cookie, state, NOW - 1)).toBeNull();
    const bad = signDiscordState(SECRET, state, USER, Number.NaN);
    expect(verifyDiscordState(SECRET, bad, state, NOW)).toBeNull();
  });
});

describe("readCookie", () => {
  it("finds a cookie by exact name", () => {
    const headers = new Headers({ cookie: "a-x=1; a=2; b=3" });
    expect(readCookie(headers, "a")).toBe("2");
    expect(readCookie(headers, "c")).toBeNull();
    expect(readCookie(new Headers(), "a")).toBeNull();
  });
});
