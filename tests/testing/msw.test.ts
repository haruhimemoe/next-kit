/**
 * @file tests/testing/msw.test.ts
 * @desc setupMsw: the file's handlers answer, a test's own handler lasts only for that test,
 *       and a request nothing handles fails instead of reaching the network.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { setupMsw } from "../../src/testing/index.js";

const server = setupMsw(http.get("https://osu.test/a", () => HttpResponse.json({ a: 1 })));

describe("setupMsw", () => {
  it("serves the file's handlers", async () => {
    expect(await (await fetch("https://osu.test/a")).json()).toEqual({ a: 1 });
  });

  it("adds a handler for one test", async () => {
    server.use(http.get("https://osu.test/b", () => HttpResponse.json({ b: 2 })));
    expect(await (await fetch("https://osu.test/b")).json()).toEqual({ b: 2 });
  });

  it("forgets it after that test, and refuses unhandled requests", async () => {
    await expect(fetch("https://osu.test/b")).rejects.toThrow();
  });
});
