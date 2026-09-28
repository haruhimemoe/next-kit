/**
 * @file tests/server/errors.test.ts
 * @desc jsonError, errorCodeFor, noStore and withHeaders: the apps' own cases (packs and pools
 *       tests/unit/lib/api.test.ts), with pools' 503 code.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import {
  ERROR_CODES,
  errorCodeFor,
  jsonError,
  noStore,
  withHeaders,
} from "../../src/server/index.js";

describe("jsonError", () => {
  it("answers { error: { code, message } } with the status", async () => {
    const response = jsonError(404, "Pack not found.");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "not_found", message: "Pack not found." },
    });
  });

  it("takes an explicit code", async () => {
    const response = jsonError(401, "That API key isn't valid.", "invalid_api_key");
    expect(await response.json()).toEqual({
      error: { code: "invalid_api_key", message: "That API key isn't valid." },
    });
  });

  it("answers every listed status with its code", async () => {
    for (const [status, code] of Object.entries(ERROR_CODES)) {
      expect(await jsonError(Number(status), "x").json()).toEqual({
        error: { code, message: "x" },
      });
    }
  });
});

describe("errorCodeFor", () => {
  it.each([
    [400, "bad_request"],
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
    [409, "conflict"],
    [413, "too_large"],
    [415, "unsupported_media_type"],
    [429, "rate_limited"],
    [500, "internal_error"],
    [502, "upstream_error"],
    [503, "unavailable"],
  ])("maps %i to %s", (status, code) => {
    expect(errorCodeFor(status)).toBe(code);
  });

  it("falls back by class for statuses without their own code", () => {
    expect(errorCodeFor(418)).toBe("bad_request");
    expect(errorCodeFor(504)).toBe("internal_error");
  });

  it("keeps the table frozen", () => {
    expect(Object.isFrozen(ERROR_CODES)).toBe(true);
  });
});

describe("noStore and withHeaders", () => {
  it("marks a response no-store", async () => {
    const response = noStore(jsonError(503, "Try again."));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      error: { code: "unavailable", message: "Try again." },
    });
  });

  it("sets every header given and returns the same response", () => {
    const response = new Response("ok");
    expect(withHeaders(response, { "X-A": "1", "X-B": "2" })).toBe(response);
    expect(response.headers.get("x-a")).toBe("1");
    expect(response.headers.get("x-b")).toBe("2");
  });
});
