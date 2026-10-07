/**
 * @file tests/i18n/middleware.test.ts
 * @desc createI18nMiddleware on the real next-intl: as-needed prefixes, the NEXT_LOCALE cookie
 *       on the parent domain, and the app's next step after locale handling.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { NextRequest } from "next/server.js";
import { describe, expect, it, vi } from "vitest";
import { createI18nMiddleware } from "../../src/i18n/next-intl/index.js";

const config = { locales: ["en", "ja"], defaultLocale: "en" };
const req = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(new URL(path, "https://www.haruhime.moe"), { headers });

describe("createI18nMiddleware", () => {
  it("serves the default locale without a prefix", async () => {
    const response = await createI18nMiddleware({ config })(req("/account"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toContain("/en/account");
  });

  it("redirects a negotiated non-default locale; a prefixed path sets the shared cookie", async () => {
    const next = vi.fn(() => new Response("app"));
    const middleware = createI18nMiddleware({ config, cookieDomain: ".haruhime.moe", next });
    const response = await middleware(req("/account", { "accept-language": "ja-JP" }));
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.headers.get("location")).toContain("/ja/account");
    expect(next).not.toHaveBeenCalled();
    const prefixed = await createI18nMiddleware({ config, cookieDomain: ".haruhime.moe" })(
      req("/ja/account"),
    );
    expect(prefixed.headers.get("set-cookie") ?? "").toMatch(
      /NEXT_LOCALE=ja.*Domain=\.haruhime\.moe/i,
    );
  });

  it("runs the app's next step after locale handling", async () => {
    const own = createI18nMiddleware({ config, next: () => new Response("app", { status: 401 }) });
    expect((await own(req("/ja/account"))).status).toBe(401);
    const pass = createI18nMiddleware({ config, next: () => undefined });
    expect((await pass(req("/ja/account"))).status).toBe(200);
  });

  it("keeps next-intl's locale cookie on the app's own response and passes the intl response", async () => {
    let seen: Response | undefined;
    const middleware = createI18nMiddleware({
      config,
      next: async (_req, intl) => {
        seen = intl;
        return new Response("app", { status: 401 });
      },
    });
    const response = await middleware(req("/ja/account"));
    expect(response.status).toBe(401);
    expect(seen?.status).toBe(200);
    expect(response.headers.get("set-cookie") ?? "").toMatch(/NEXT_LOCALE=ja/);
    const same = createI18nMiddleware({ config, next: (_req, intl) => intl });
    expect((await same(req("/ja/account"))).status).toBe(200);
  });
});
