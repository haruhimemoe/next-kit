/**
 * @file tests/auth-react/marker.test.ts
 * @desc createSignedInMarker and markerMaxAge: the cases packs and pools both had
 *       (tests/unit/lib/signed-in-marker.test.ts), with the cookie name passed in.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { createSignedInMarker, markerMaxAge } from "../../src/auth-react/index.js";

const marker = createSignedInMarker("pools-signed-in");

describe("signed-in marker", () => {
  it("keeps its name", () => {
    expect(marker.name).toBe("pools-signed-in");
  });

  it.each([
    ["pools-signed-in=1", true],
    ["a=b; pools-signed-in=1; c=d", true],
    ["pools-signed-in=0", false],
    ["xpools-signed-in=1", false],
    ["packs-signed-in=1", false],
    ["", false],
  ])("reads %j as %s", (cookie, expected) => {
    expect(marker.has(cookie)).toBe(expected);
  });

  it("lives until the session expires, never negative", () => {
    const now = Date.parse("2026-09-27T00:00:00Z");
    expect(markerMaxAge("2026-10-04T00:00:00Z", now)).toBe(7 * 24 * 60 * 60);
    expect(markerMaxAge(new Date(now - 1000), now)).toBe(0);
    expect(markerMaxAge(new Date(Date.now() + 10_000))).toBeGreaterThan(8);
  });

  it("clears itself by expiring", () => {
    const target = { cookie: "" };
    marker.clear(target);
    expect(target.cookie).toBe("pools-signed-in=; Path=/; Max-Age=0; SameSite=Lax");
  });

  it("clears the document's cookie by default", () => {
    // biome-ignore lint/suspicious/noDocumentCookie: sets the marker as the server's Set-Cookie would
    document.cookie = "pools-signed-in=1; Path=/";
    expect(marker.has(document.cookie)).toBe(true);
    marker.clear();
    expect(marker.has(document.cookie)).toBe(false);
  });
});
