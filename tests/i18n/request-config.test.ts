/**
 * @file tests/i18n/request-config.test.ts
 * @desc createRequestConfig: locale from the segment, then (prefix-less) the cookie, the saved
 *       user locale and Accept-Language, then the
 *       default; package catalogs merge first and the app's messages win.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Sun Oct 11, 2026
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

describe("prefix-less requests", () => {
  const hints = (cookie: string | null, acceptLanguage: string | null) => async () => ({
    cookie,
    acceptLanguage,
  });

  it("prefers the NEXT_LOCALE cookie over the saved locale and the header", async () => {
    const userLocale = vi.fn(async () => "en");
    const resolved = await resolveRequestConfig(
      { ...options, userLocale, request: hints("ja", "en") },
      undefined,
    );
    expect(resolved.locale).toBe("ja");
    expect(userLocale).not.toHaveBeenCalled();
  });

  it("then the saved locale, then Accept-Language, then the default", async () => {
    const ja = async () => "ja";
    expect(
      (
        await resolveRequestConfig(
          { ...options, userLocale: ja, request: hints("fr", "en") },
          undefined,
        )
      ).locale,
    ).toBe("ja");
    expect(
      (
        await resolveRequestConfig(
          { ...options, request: hints(null, "ja-JP,en;q=0.5") },
          undefined,
        )
      ).locale,
    ).toBe("ja");
    expect(
      (await resolveRequestConfig({ ...options, request: hints(null, null) }, undefined)).locale,
    ).toBe("en");
  });

  it("a matched segment still wins", async () => {
    expect(
      (await resolveRequestConfig({ ...options, request: hints("ja", "ja") }, "en")).locale,
    ).toBe("en");
  });
});

it("readRequestLocale reads the cookie and header through next/headers", async () => {
  vi.doMock("next/headers.js", () => ({
    cookies: async () => ({
      get: (name: string) => (name === "NEXT_LOCALE" ? { value: "ja" } : undefined),
    }),
    headers: async () => new Headers({ "accept-language": "ko" }),
  }));
  const { readRequestLocale } = await import("../../src/i18n/next-intl/index.js");
  expect(await readRequestLocale()).toEqual({ cookie: "ja", acceptLanguage: "ko" });
});
