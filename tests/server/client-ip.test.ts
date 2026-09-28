/**
 * @file tests/server/client-ip.test.ts
 * @desc clientIp and rateLimitSubject: the test file packs and pools both had, unchanged.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { clientIp, MAX_IP_LENGTH, rateLimitSubject } from "../../src/server/index.js";

describe("clientIp", () => {
  it("prefers x-real-ip", () => {
    expect(
      clientIp(new Headers({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "198.51.100.7" })),
    ).toBe("203.0.113.9");
  });

  it("falls back to the first x-forwarded-for entry, trimmed", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "  198.51.100.7 , 10.0.0.1" }))).toBe(
      "198.51.100.7",
    );
  });

  it("skips a blank x-real-ip", () => {
    expect(clientIp(new Headers({ "x-real-ip": "  ", "x-forwarded-for": "198.51.100.7" }))).toBe(
      "198.51.100.7",
    );
  });

  it("keeps IPv6 addresses whole", () => {
    expect(clientIp(new Headers({ "x-real-ip": "2001:db8::1" }))).toBe("2001:db8::1");
  });

  it('is "unknown" with neither header', () => {
    expect(clientIp(new Headers())).toBe("unknown");
    expect(clientIp(new Headers({ "x-forwarded-for": " , " }))).toBe("unknown");
  });

  it("caps a huge header", () => {
    expect(clientIp(new Headers({ "x-real-ip": "9".repeat(500) }))).toHaveLength(MAX_IP_LENGTH);
  });
});

describe("rateLimitSubject", () => {
  it("keeps an IPv4 address whole", () => {
    expect(rateLimitSubject("203.0.113.9")).toBe("203.0.113.9");
  });

  it("keys a full IPv6 address by its /64, lowercased, without leading zeros", () => {
    expect(rateLimitSubject("2001:0DB8:0001:0002:0003:0004:0005:0006")).toBe("2001:db8:1:2::/64");
  });

  it("expands a compressed IPv6 address before taking the /64", () => {
    expect(rateLimitSubject("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(rateLimitSubject("2001:db8:1:2::ffff")).toBe("2001:db8:1:2::/64");
    expect(rateLimitSubject("fe80::")).toBe("fe80:0:0:0::/64");
  });

  it("keys ::1 by its /64", () => {
    expect(rateLimitSubject("::1")).toBe("0:0:0:0::/64");
  });

  it("puts two addresses in one /64 on one subject", () => {
    expect(rateLimitSubject("2001:db8:1:2::1")).toBe(rateLimitSubject("2001:db8:1:2:aaaa::9"));
    expect(rateLimitSubject("2001:db8:1:2::1")).not.toBe(rateLimitSubject("2001:db8:1:3::1"));
  });

  it("returns the IPv4 part of an IPv4-mapped IPv6 address", () => {
    expect(rateLimitSubject("::ffff:203.0.113.9")).toBe("203.0.113.9");
    expect(rateLimitSubject("::FFFF:cb00:7109")).toBe("203.0.113.9");
  });

  it('returns "unknown" and junk unchanged', () => {
    expect(rateLimitSubject("unknown")).toBe("unknown");
    for (const junk of ["not-an-ip", "1:2:3", "1::2::3", "g::1", "1:2:3:4:5:6:7:8:9", "12345::1"]) {
      expect(rateLimitSubject(junk)).toBe(junk);
    }
  });
});
