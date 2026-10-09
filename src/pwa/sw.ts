/**
 * @file src/pwa/sw.ts
 * @desc The service worker, as a script string and as the Response an app's `app/sw.js/route.ts`
 *       returns. It does two things and leaves every other request alone: Next's hashed build
 *       files (/_next/static/) come from a cache once fetched, and a page that can't load offline
 *       gets a small offline page instead of the browser's error. No API, auth or HTML response
 *       is ever cached, so nothing signed in goes stale. A new version drops the old caches.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Oct 9, 2026
 * @modified Fri Oct 9, 2026
 */

import { type PwaApp, surfaceColor, textColor } from "./app.js";

/** serviceWorkerScript()'s options. */
export type ServiceWorkerOptions = {
  /** Changes on every deploy (a commit SHA), so old caches are dropped. */
  version: string;
  /** The offline page's heading. Default "You're offline". */
  offlineTitle?: string;
  /** The offline page's line under it. */
  offlineMessage?: string;
};

const escapeHtml = (text: string): string =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

/**
 * @function offlineHtml
 * @param app {PwaApp} the app
 * @param options {ServiceWorkerOptions} the offline copy
 * @returns {string} a self-contained offline page in the app's colors with a Try again button
 */
export const offlineHtml = (app: PwaApp, options: ServiceWorkerOptions): string => {
  const bg = surfaceColor(app);
  const fg = textColor(app);
  const title = escapeHtml(options.offlineTitle ?? "You're offline");
  const message = escapeHtml(
    options.offlineMessage ??
      `${app.shortName} needs a connection for this page. Try again once you're back online.`,
  );
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="${app.scheme ?? "dark"}"><title>${title} · ${escapeHtml(app.shortName)}</title><style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:${bg};color:${fg};font:16px/1.5 system-ui,sans-serif;padding:16px;box-sizing:border-box;text-align:center}main{max-width:28rem}h1{font-size:1.5rem;margin:0 0 .5rem}p{margin:0 0 1.5rem;opacity:.8}button{font:inherit;font-weight:700;color:inherit;background:transparent;border:2px solid currentColor;border-radius:999px;min-height:44px;padding:0 1.25rem;cursor:pointer}</style></head><body><main><h1>${title}</h1><p>${message}</p><button type="button" onclick="location.reload()">Try again</button></main></body></html>`;
};

/**
 * @function serviceWorkerScript
 * @param app {PwaApp} the app
 * @param options {ServiceWorkerOptions} the version and offline copy
 * @returns {string} the service worker's JavaScript
 */
export const serviceWorkerScript = (app: PwaApp, options: ServiceWorkerOptions): string => {
  const version = JSON.stringify(options.version);
  const page = JSON.stringify(offlineHtml(app, options));
  return `// ${app.name} service worker. Built by @haruhimemoe/next-kit/pwa.
const VERSION = ${version};
const STATIC = "static-" + VERSION;
const PAGES = "offline-" + VERSION;
const OFFLINE = "/__offline";
const PAGE = ${page};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) =>
        cache.put(OFFLINE, new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } })),
      ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== STATIC && key !== PAGES) await caches.delete(key);
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return (await event.preloadResponse) || (await fetch(request));
        } catch {
          return (await caches.match(OFFLINE)) || Response.error();
        }
      })(),
    );
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      }),
    );
  }
});
`;
};

/**
 * @function serviceWorkerResponse
 * @param app {PwaApp} the app
 * @param options {ServiceWorkerOptions} the version and offline copy
 * @returns {Response} the script as JavaScript, never cached by the browser's HTTP cache, so a
 *          deploy reaches every visitor on their next page load
 */
export const serviceWorkerResponse = (app: PwaApp, options: ServiceWorkerOptions): Response =>
  new Response(serviceWorkerScript(app, options), {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "no-cache, no-store, must-revalidate",
      "service-worker-allowed": "/",
    },
  });
