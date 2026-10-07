/**
 * @file tests/account/fan-out.test.ts
 * @desc fanOut with an injected fetcher: all ok, one app down (delete retried 3 times), one app
 *       not configured, export data per app, a 3xx as a failure with redirect "manual", a
 *       non-https baseUrl refused, and exportBundle.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { describe, expect, it, vi } from "vitest";
import { exportBundle, fanOut } from "../../src/account/fan-out.js";

const USER = "0123456789abcdef01234567";
const apps = [
  { id: "bb", name: "bb", baseUrl: "https://bb.haruhime.moe", secretEnv: "SECRET_BB" },
  { id: "packs", name: "packs", baseUrl: "https://packs.haruhime.moe", secretEnv: "SECRET_PACKS" },
];
const env = { SECRET_BB: "b".repeat(32), SECRET_PACKS: "p".repeat(32) };
const sleep = vi.fn(async () => {});

const fetcherFor = (answer: (url: string) => Response | Promise<Response>) =>
  vi.fn(async (input: string | URL | Request) => answer(String(input))) as unknown as typeof fetch;

describe("fanOut", () => {
  it("posts { userId } with each app's own secret and never follows redirects", async () => {
    const fetcher = fetcherFor(() => new Response(null, { status: 204 }));
    const report = await fanOut({ apps, op: "delete", userId: USER, env, fetcher, sleep });
    expect(report).toEqual({
      ok: true,
      results: [
        { id: "bb", ok: true, status: 204 },
        { id: "packs", ok: true, status: 204 },
      ],
    });
    const [url, init] = vi.mocked(fetcher).mock.calls[0] ?? [];
    expect(String(url)).toBe("https://bb.haruhime.moe/api/internal/account/delete");
    expect(init?.redirect).toBe("manual");
    expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${"b".repeat(32)}`);
    expect(JSON.parse(String(init?.body))).toEqual({ userId: USER });
  });

  it("retries a failing delete 3 times in all, then reports it", async () => {
    sleep.mockClear();
    const fetcher = fetcherFor((url) =>
      url.includes("packs")
        ? new Response(null, { status: 500 })
        : new Response(null, { status: 204 }),
    );
    const report = await fanOut({ apps, op: "delete", userId: USER, env, fetcher, sleep });
    expect(report.ok).toBe(false);
    expect(report.results[1]).toEqual({ id: "packs", ok: false, status: 500, error: "app_error" });
    expect(vi.mocked(fetcher).mock.calls.filter(([u]) => String(u).includes("packs"))).toHaveLength(
      3,
    );
    expect(sleep.mock.calls).toEqual([[250], [1000]]);
  });

  it("reports an unreachable app", async () => {
    const fetcher = fetcherFor(() => Promise.reject(new TypeError("fetch failed")));
    const report = await fanOut({
      apps: apps.slice(0, 1),
      op: "export",
      userId: USER,
      env,
      fetcher,
    });
    expect(report.results[0]).toEqual({ id: "bb", ok: false, status: 0, error: "unreachable" });
  });

  it("skips an app whose secret is unset", async () => {
    const fetcher = fetcherFor(() => Response.json({}));
    const report = await fanOut({
      apps,
      op: "export",
      userId: USER,
      env: { SECRET_BB: env.SECRET_BB },
      fetcher,
    });
    expect(report.results[1]).toEqual({
      id: "packs",
      ok: false,
      status: 0,
      error: "not_configured",
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("carries each app's export data", async () => {
    const fetcher = fetcherFor((url) => Response.json({ from: new URL(url).hostname }));
    const report = await fanOut({ apps, op: "export", userId: USER, env, fetcher });
    expect(report.results.map((r) => r.data)).toEqual([
      { from: "bb.haruhime.moe" },
      { from: "packs.haruhime.moe" },
    ]);
  });

  it("treats a 3xx answer as a failure", async () => {
    const fetcher = fetcherFor(
      () => new Response(null, { status: 302, headers: { location: "https://evil.test" } }),
    );
    const report = await fanOut({
      apps: apps.slice(0, 1),
      op: "export",
      userId: USER,
      env,
      fetcher,
    });
    expect(report.results[0]).toEqual({ id: "bb", ok: false, status: 302, error: "redirect" });
  });

  it("refuses a non-https baseUrl without calling it", async () => {
    const fetcher = fetcherFor(() => Response.json({}));
    const report = await fanOut({
      apps: [{ ...apps[0], baseUrl: "http://bb.haruhime.moe" } as (typeof apps)[0]],
      op: "export",
      userId: USER,
      env,
      fetcher,
    });
    expect(report.results[0]?.error).toBe("insecure_url");
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("exportBundle", () => {
  it("keys data by app and marks failures", () => {
    expect(
      exportBundle(
        { osuId: 1 },
        [
          { id: "bb", ok: true, status: 200, data: { posts: [] } },
          { id: "packs", ok: false, status: 0, error: "not_configured" },
        ],
        () => Date.parse("2026-10-06T00:00:00.000Z"),
      ),
    ).toEqual({
      exportedAt: "2026-10-06T00:00:00.000Z",
      identity: { osuId: 1 },
      apps: { bb: { posts: [] }, packs: { error: "not_configured" } },
    });
  });
});
