/**
 * @file tests/server/windows.test.ts
 * @desc windowFor, rateLimitId, rateLimitHeaders, retryText, tooManyRequests, unlimited and
 *       userSubject: packs' unit cases (tests/unit/lib/rate-limit.test.ts), no database.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import {
  rateLimitHeaders,
  rateLimitId,
  retryText,
  tooManyRequests,
  unlimited,
  userSubject,
  windowFor,
} from "../../src/server/index.js";

const MINUTE = { scope: "api", limit: 60, windowSeconds: 60 };
const HOUR = { scope: "key-create", limit: 5, windowSeconds: 3600 };
const AT = (iso: string) => new Date(iso).getTime();

describe("windowFor", () => {
  it("snaps to the start of the minute", () => {
    const w = windowFor(MINUTE, AT("2026-09-22T12:00:10.250Z"));
    expect(new Date(w.start).toISOString()).toBe("2026-09-22T12:00:00.000Z");
    expect(new Date(w.end).toISOString()).toBe("2026-09-22T12:01:00.000Z");
    expect(w.resetSeconds).toBe(50);
  });

  it("gives a full window at its first millisecond and 1 s at its last", () => {
    expect(windowFor(MINUTE, AT("2026-09-22T12:00:00.000Z")).resetSeconds).toBe(60);
    expect(windowFor(MINUTE, AT("2026-09-22T12:00:59.999Z")).resetSeconds).toBe(1);
  });

  it("puts :59.999 and :00.000 in different windows", () => {
    expect(rateLimitId(MINUTE, "u", AT("2026-09-22T12:00:59.999Z"))).not.toBe(
      rateLimitId(MINUTE, "u", AT("2026-09-22T12:01:00.000Z")),
    );
  });

  it("keeps a counter one minute past its window", () => {
    const w = windowFor(MINUTE, AT("2026-09-22T12:00:10.000Z"));
    expect(w.expiresAt.toISOString()).toBe("2026-09-22T12:02:00.000Z");
  });

  it("uses hour windows for an hour rule", () => {
    const w = windowFor(HOUR, AT("2026-09-22T12:30:00.000Z"));
    expect(new Date(w.start).toISOString()).toBe("2026-09-22T12:00:00.000Z");
    expect(w.resetSeconds).toBe(1800);
  });
});

describe("rateLimitId and userSubject", () => {
  it("is scope:subject:windowStartSeconds", () => {
    const rule = { scope: "auth-fail", limit: 10, windowSeconds: 60 };
    expect(rateLimitId(rule, "203.0.113.9", AT("2026-09-22T12:00:10.000Z"))).toBe(
      `auth-fail:203.0.113.9:${AT("2026-09-22T12:00:00.000Z") / 1000}`,
    );
  });

  it("keys a user on their osu! id", () => {
    expect(userSubject({ osuId: 2 })).toBe("osu:2");
  });
});

describe("rateLimitHeaders", () => {
  it("sends limit, remaining and reset", () => {
    expect(rateLimitHeaders({ allowed: true, limit: 60, remaining: 12, resetSeconds: 30 })).toEqual(
      { "RateLimit-Limit": "60", "RateLimit-Remaining": "12", "RateLimit-Reset": "30" },
    );
  });

  it("adds Retry-After when refused", () => {
    expect(
      rateLimitHeaders({ allowed: false, limit: 60, remaining: 0, resetSeconds: 30 }),
    ).toMatchObject({ "Retry-After": "30" });
  });
});

describe("retryText", () => {
  it.each([
    [1, "1 second"],
    [45, "45 seconds"],
    [60, "1 minute"],
    [61, "2 minutes"],
    [1800, "30 minutes"],
  ])("%i is %j", (seconds, text) => {
    expect(retryText(seconds)).toBe(text);
  });
});

describe("tooManyRequests and unlimited", () => {
  it("answers 429 rate_limited with every header", async () => {
    const response = tooManyRequests({ allowed: false, limit: 10, remaining: 0, resetSeconds: 42 });
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: { code: "rate_limited", message: "Too many requests. Try again in 42 seconds." },
    });
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(response.headers.get("RateLimit-Limit")).toBe("10");
  });

  it("reports nothing counted as the full limit left", () => {
    expect(unlimited(MINUTE, AT("2026-09-22T12:00:10.000Z"))).toEqual({
      allowed: true,
      limit: 60,
      remaining: 60,
      resetSeconds: 50,
    });
  });
});
