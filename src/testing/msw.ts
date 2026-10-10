/**
 * @file src/testing/msw.ts
 * @desc setupMsw(...handlers): an msw server for the test file, listening before the tests with
 *       every unhandled request an error (so nothing reaches osu!, the mirror or another app),
 *       reset after each test, closed after the file. Works with msw 2 and 3: msw 3 renamed
 *       onUnhandledRequest to onUnhandledFrame, so both are passed. Moved from packs and pools
 *       (tests/helpers/msw.ts).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Sat Oct 10, 2026
 */

import type { RequestHandler } from "msw";
import { type SetupServer, setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";

/**
 * @function setupMsw
 * @param handlers {RequestHandler[]} the file's default handlers
 * @returns {SetupServer} the server (use server.use() to add handlers in a test)
 */
// Not a literal at the call, so each major's types accept the other's key.
const STRICT = { onUnhandledFrame: "error", onUnhandledRequest: "error" } as const;

export const setupMsw = (...handlers: RequestHandler[]): SetupServer => {
  const server = setupServer(...handlers);
  beforeAll(() => server.listen(STRICT));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
  return server;
};
