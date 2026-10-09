/**
 * @file tests/pwa/pwa.test.ts
 * @desc pwa: colors match the ui theme's b5 and c1, the manifest is standalone and installable
 *       (192 and 512 PNGs plus a maskable one), viewport and iOS metadata, and the service worker
 *       run against a fake worker global: hashed build files cached, a failed page load answered
 *       with the offline page, API and cross-origin requests untouched, old caches dropped.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Oct 9, 2026
 * @modified Fri Oct 9, 2026
 */

import { describe, expect, it, vi } from "vitest";
import {
  hslHex,
  offlineHtml,
  type PwaApp,
  pwaManifest,
  pwaMetadata,
  pwaViewport,
  serviceWorkerResponse,
  serviceWorkerScript,
  surfaceColor,
  textColor,
} from "../../src/pwa/index.js";

const POOLS: PwaApp = {
  name: "pools.haruhime.moe",
  shortName: "pools",
  description: "Mappools.",
  hue: 200,
};

describe("colors", () => {
  it("converts HSL to hex", () => {
    expect(hslHex(0, 100, 50)).toBe("#ff0000");
    expect(hslHex(120, 100, 25)).toBe("#008000");
    expect(hslHex(0, 0, 100)).toBe("#ffffff");
  });

  it("matches the ui theme's b5 and c1 in both schemes, any hue", () => {
    expect(surfaceColor({ hue: 200 })).toBe(hslHex(200, 10, 15));
    expect(surfaceColor({ hue: 350, scheme: "light" })).toBe(hslHex(350, 10, 97));
    expect(surfaceColor({ hue: -160 })).toBe(surfaceColor({ hue: 200 }));
    expect(textColor({ hue: 200 })).toBe("#ffffff");
    expect(textColor({ hue: 350, scheme: "light" })).toBe(hslHex(350, 40, 10));
  });
});

describe("pwaManifest", () => {
  it("is standalone, scoped to the origin and colored like the page", () => {
    const manifest = pwaManifest(POOLS);
    expect(manifest).toMatchObject({
      id: "/",
      name: "pools.haruhime.moe",
      short_name: "pools",
      start_url: "/",
      scope: "/",
      display: "standalone",
      theme_color: surfaceColor(POOLS),
      background_color: surfaceColor(POOLS),
    });
    expect(manifest).not.toHaveProperty("shortcuts");
    expect(manifest).not.toHaveProperty("categories");
    const sizes = manifest.icons?.map((icon) => `${icon.sizes} ${icon.purpose ?? "any"}`);
    expect(sizes).toEqual(["any any", "192x192 any", "512x512 any", "512x512 maskable"]);
  });

  it("takes shortcuts, categories and its own icons", () => {
    const manifest = pwaManifest(POOLS, {
      shortcuts: [{ name: "New pool", url: "/new" }],
      categories: ["games"],
      icons: [{ src: "/a.png", sizes: "512x512" }],
    });
    expect(manifest.shortcuts).toEqual([{ name: "New pool", url: "/new" }]);
    expect(manifest.categories).toEqual(["games"]);
    expect(manifest.icons).toHaveLength(1);
  });
});

describe("pwaViewport and pwaMetadata", () => {
  it("sets the theme color and scheme, and leaves zoom on", () => {
    expect(pwaViewport(POOLS)).toEqual({
      width: "device-width",
      initialScale: 1,
      themeColor: surfaceColor(POOLS),
      colorScheme: "dark",
    });
    expect(pwaViewport({ ...POOLS, scheme: "light" }).colorScheme).toBe("light");
  });

  it("opens full screen from the iOS home screen under the short name", () => {
    expect(pwaMetadata(POOLS)).toEqual({
      applicationName: "pools",
      appleWebApp: { capable: true, title: "pools", statusBarStyle: "default" },
    });
  });
});

describe("offlineHtml", () => {
  it("escapes the copy and offers Try again", () => {
    const html = offlineHtml(
      { ...POOLS, shortName: "<p>" },
      { version: "1", offlineTitle: `"Hi" & bye` },
    );
    expect(html).toContain("&quot;Hi&quot; &amp; bye");
    expect(html).toContain("&lt;p&gt; needs a connection");
    expect(html).not.toContain("<p> needs");
    expect(html).toContain("location.reload()");
    expect(html).toContain(`background:${surfaceColor(POOLS)}`);
  });

  it("uses the given message and the light scheme", () => {
    const html = offlineHtml(
      { ...POOLS, scheme: "light" },
      { version: "1", offlineMessage: "Later." },
    );
    expect(html).toContain("<p>Later.</p>");
    expect(html).toContain('content="light"');
  });
});

type Listener = (event: Record<string, unknown>) => void;

/** Runs the worker script against a fake `self`, `caches` and `fetch`. */
const boot = (version = "v2", oldKeys: string[] = []) => {
  const stores = new Map<string, Map<string, Response>>(oldKeys.map((k) => [k, new Map()]));
  const keyOf = (request: Request | string) =>
    typeof request === "string" ? request : request.url;
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name) as Map<string, Response>;
    return {
      match: async (request: Request | string) => store.get(keyOf(request))?.clone(),
      put: async (request: Request | string, response: Response) => {
        store.set(keyOf(request), response);
      },
    };
  };
  const caches = {
    open,
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (request: string) => {
      for (const store of stores.values())
        if (store.has(request)) return store.get(request)?.clone();
      return undefined;
    },
  };
  const listeners: Record<string, Listener> = {};
  const self = {
    location: { origin: "https://pools.haruhime.moe" },
    registration: { navigationPreload: { enable: vi.fn(async () => undefined) } },
    clients: { claim: vi.fn(async () => undefined) },
    skipWaiting: vi.fn(),
    addEventListener: (type: string, listener: Listener) => {
      listeners[type] = listener;
    },
  };
  const fetch = vi.fn(async (_request: Request) => new Response("net", { status: 200 }));
  new Function("self", "caches", "fetch", serviceWorkerScript(POOLS, { version }))(
    self,
    caches,
    fetch,
  );
  const lifecycle = async (type: "install" | "activate") => {
    let work: Promise<unknown> = Promise.resolve();
    listeners[type]?.({ waitUntil: (p: Promise<unknown>) => (work = p) });
    await work;
  };
  const request = async (
    url: string,
    init: { method?: string; mode?: string; preload?: Response } = {},
  ) => {
    let answer: Promise<Response> | undefined;
    const req = Object.assign(new Request(url, { method: init.method ?? "GET" }), {});
    Object.defineProperty(req, "mode", { value: init.mode ?? "cors" });
    listeners.fetch?.({
      request: req,
      preloadResponse: Promise.resolve(init.preload),
      respondWith: (p: Promise<Response>) => (answer = p),
    });
    return answer;
  };
  return { stores, self, fetch, lifecycle, request };
};

describe("serviceWorkerScript", () => {
  it("stores the offline page on install, drops old caches and claims pages on activate", async () => {
    const sw = boot("v2", ["static-v1", "offline-v1"]);
    await sw.lifecycle("install");
    expect(sw.self.skipWaiting).toHaveBeenCalled();
    await sw.lifecycle("activate");
    expect([...sw.stores.keys()].sort()).toEqual(["offline-v2"]);
    expect(sw.self.registration.navigationPreload.enable).toHaveBeenCalled();
    expect(sw.self.clients.claim).toHaveBeenCalled();
  });

  it("caches hashed build files after the first fetch", async () => {
    const sw = boot();
    const url = "https://pools.haruhime.moe/_next/static/chunks/a.js";
    expect(await (await sw.request(url))?.text()).toBe("net");
    expect(await (await sw.request(url))?.text()).toBe("net");
    expect(sw.fetch).toHaveBeenCalledTimes(1);
  });

  it("doesn't cache a failed build file", async () => {
    const sw = boot();
    sw.fetch.mockResolvedValueOnce(new Response("", { status: 404 }));
    await sw.request("https://pools.haruhime.moe/_next/static/x.js");
    await sw.request("https://pools.haruhime.moe/_next/static/x.js");
    expect(sw.fetch).toHaveBeenCalledTimes(2);
  });

  it("answers pages from the network or navigation preload, the offline page when both fail", async () => {
    const sw = boot();
    await sw.lifecycle("install");
    const page = "https://pools.haruhime.moe/pools/1";
    expect(await (await sw.request(page, { mode: "navigate" }))?.text()).toBe("net");
    const preload = new Response("preloaded");
    expect(await (await sw.request(page, { mode: "navigate", preload }))?.text()).toBe("preloaded");
    sw.fetch.mockRejectedValueOnce(new TypeError("offline"));
    const offline = await sw.request(page, { mode: "navigate" });
    expect(await offline?.text()).toContain("You&#39;re offline");
  });

  it("returns a network error offline before install finished", async () => {
    const sw = boot();
    sw.fetch.mockRejectedValueOnce(new TypeError("offline"));
    const answer = await sw.request("https://pools.haruhime.moe/", { mode: "navigate" });
    expect(answer?.type).toBe("error");
  });

  it("leaves API calls, other origins and non-GET requests to the browser", async () => {
    const sw = boot();
    expect(await sw.request("https://pools.haruhime.moe/api/pools")).toBeUndefined();
    expect(await sw.request("https://osu.ppy.sh/_next/static/a.js")).toBeUndefined();
    expect(
      await sw.request("https://pools.haruhime.moe/_next/static/a.js", { method: "POST" }),
    ).toBeUndefined();
    expect(sw.fetch).not.toHaveBeenCalled();
  });
});

describe("serviceWorkerResponse", () => {
  it("serves the script as uncached JavaScript allowed at the root", async () => {
    const response = serviceWorkerResponse(POOLS, { version: "abc" });
    expect(response.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(response.headers.get("cache-control")).toContain("no-cache");
    expect(response.headers.get("service-worker-allowed")).toBe("/");
    expect(await response.text()).toContain('const VERSION = "abc";');
  });
});
