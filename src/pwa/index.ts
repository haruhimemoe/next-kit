/**
 * @file src/pwa/index.ts
 * @desc @haruhimemoe/next-kit/pwa: install support for a haruhime app. The manifest
 *       (app/manifest.ts), the viewport and iOS metadata for the root layout, the service worker
 *       (app/sw.js/route.ts) and the component that registers it. No "use client" here: the
 *       component file carries it, so app/manifest.ts can import from this entry point.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Oct 9, 2026
 * @modified Fri Oct 9, 2026
 */

export { hslHex, type PwaApp, surfaceColor, textColor } from "./app.js";
export {
  PWA_ICONS,
  type PwaManifestOptions,
  pwaManifest,
  pwaMetadata,
  pwaViewport,
} from "./metadata.js";
export { ServiceWorkerRegister, type ServiceWorkerRegisterProps } from "./ServiceWorkerRegister.js";
export {
  offlineHtml,
  type ServiceWorkerOptions,
  serviceWorkerResponse,
  serviceWorkerScript,
} from "./sw.js";
