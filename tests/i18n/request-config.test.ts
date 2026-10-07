/**
 * @file tests/i18n/request-config.test.ts
 * @desc createRequestConfig: locale from the segment, then the saved user locale, then the
 *       default; package catalogs merge first and the app's messages win.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { describe, expect, it, vi } from "vitest";

// Outside a react-server build next-intl/server's getRequestConfig throws; Next passes it through.
vi.mock("next-intl/server", () => ({ getRequestConfig: (fn: unknown) => fn }));

const { createRequestConfig, mergeMessages, resolveRequestConfig } = await import(
  "../../src/i18n/next-intl/index.js"
);

const config = { locales: ["en", "ja"], defaultLocale: "en" };
const options = {
  config,
  packages: [
    async (locale: string) => ({ ui: { ok: `ui-${locale}`, cancel: "Cancel" } }),
    async () => ({ ui: { cancel: "Close" } }),
  ],
  app: async (locale: string) => ({ ui: { ok: "OK" }, home: { title: locale } }),
};

describe("mergeMessages", () => {
  it("merges deeply, later wins, inputs untouched, no prototype keys", () => {
    const a = { x: { y: 1, z: 2 } };
    expect(mergeMessages(a, { x: { y: 3 } }, { w: [1] })).toEqual({ x: { y: 3, z: 2 }, w: [1] });
    expect(a).toEqual({ x: { y: 1, z: 2 } });
    const merged = mergeMessages(JSON.parse('{"__proto__":{"polluted":1}}'));
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.keys(merged)).toEqual([]);
  });
});

describe("resolveRequestConfig", () => {
  it("uses the matched segment and merges catalogs in order", async () => {
    expect(await resolveRequestConfig(options, "ja")).toEqual({
      locale: "ja",
      messages: { ui: { ok: "OK", cancel: "Close" }, home: { title: "ja" } },
    });
  });

  it("falls back to the saved user locale, then the default", async () => {
    const userLocale = vi.fn(async () => "ja");
    expect((await resolveRequestConfig({ ...options, userLocale }, "xx")).locale).toBe("ja");
    expect((await resolveRequestConfig({ ...options, userLocale }, "en")).locale).toBe("en");
    expect(userLocale).toHaveBeenCalledTimes(1);
    const bad = async () => "fr";
    expect((await resolveRequestConfig({ ...options, userLocale: bad }, undefined)).locale).toBe(
      "en",
    );
    expect((await resolveRequestConfig({ config, app: options.app }, undefined)).messages).toEqual({
      ui: { ok: "OK" },
      home: { title: "en" },
    });
  });
});

it("createRequestConfig hands next-intl the resolved config", async () => {
  const handler = createRequestConfig(options) as unknown as (p: {
    requestLocale: Promise<string | undefined>;
  }) => Promise<{ locale: string }>;
  expect((await handler({ requestLocale: Promise.resolve("ja") })).locale).toBe("ja");
});
