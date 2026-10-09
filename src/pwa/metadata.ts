/**
 * @file src/pwa/metadata.ts
 * @desc The web app manifest (pwaManifest, for app/manifest.ts), the root layout's viewport
 *       (theme color and color scheme) and the metadata iOS reads to open the app full screen
 *       from the home screen. Next's types only.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Oct 9, 2026
 * @modified Fri Oct 9, 2026
 */

import type { Metadata, MetadataRoute, Viewport } from "next";
import { type PwaApp, surfaceColor } from "./app.js";

/** The icon files every app ships: the app router's icon.svg, and three PNGs in public/. */
export const PWA_ICONS: NonNullable<MetadataRoute.Manifest["icons"]> = [
  { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
  { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
  { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
  { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

/** pwaManifest()'s extras. */
export type PwaManifestOptions = {
  /** Home-screen long-press shortcuts, like { name: "New pool", url: "/new" }. */
  shortcuts?: MetadataRoute.Manifest["shortcuts"];
  /** Store categories, like ["games", "utilities"]. */
  categories?: string[];
  /** Replaces PWA_ICONS. */
  icons?: MetadataRoute.Manifest["icons"];
};

/**
 * @function pwaManifest
 * @param app {PwaApp} the app
 * @param options {PwaManifestOptions} shortcuts, categories, icons
 * @returns {MetadataRoute.Manifest} a standalone manifest scoped to the whole origin, colored like
 *          the page
 */
export const pwaManifest = (
  app: PwaApp,
  options: PwaManifestOptions = {},
): MetadataRoute.Manifest => {
  const color = surfaceColor(app);
  return {
    id: "/",
    name: app.name,
    short_name: app.shortName,
    description: app.description,
    lang: "en",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: color,
    theme_color: color,
    icons: options.icons ?? PWA_ICONS,
    ...(options.categories ? { categories: options.categories } : {}),
    ...(options.shortcuts ? { shortcuts: options.shortcuts } : {}),
  };
};

/**
 * @function pwaViewport
 * @param app {PwaApp} the app
 * @returns {Viewport} the root layout's viewport: device width, zoom left on, the page color as
 *          the browser's theme color, and the app's color scheme
 */
export const pwaViewport = (app: PwaApp): Viewport => ({
  width: "device-width",
  initialScale: 1,
  themeColor: surfaceColor(app),
  colorScheme: app.scheme ?? "dark",
});

/**
 * @function pwaMetadata
 * @param app {PwaApp} the app
 * @returns {Metadata} applicationName and appleWebApp (full screen from the home screen, the short
 *          name under the icon); spread it over the layout's own metadata
 */
export const pwaMetadata = (app: PwaApp): Metadata => ({
  applicationName: app.shortName,
  appleWebApp: { capable: true, title: app.shortName, statusBarStyle: "default" },
});
