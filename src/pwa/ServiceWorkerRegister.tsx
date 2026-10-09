/**
 * @file src/pwa/ServiceWorkerRegister.tsx
 * @desc Registers the app's service worker once the page has loaded, in production builds only
 *       (a dev server's files change under it). Renders nothing; put it in the root layout.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Oct 9, 2026
 * @modified Fri Oct 9, 2026
 */

"use client";

import { useEffect } from "react";

/** ServiceWorkerRegister's props. */
export type ServiceWorkerRegisterProps = {
  /** The script's path. Default "/sw.js". */
  src?: string;
  /** Default: on in production builds only. */
  enabled?: boolean;
};

/**
 * @function ServiceWorkerRegister
 * @param props {ServiceWorkerRegisterProps} the script path and the switch
 * @returns {null} nothing
 */
export function ServiceWorkerRegister({
  src = "/sw.js",
  enabled = process.env.NODE_ENV === "production",
}: ServiceWorkerRegisterProps) {
  useEffect(() => {
    if (!enabled || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register(src, { scope: "/" }).catch(() => undefined);
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, [enabled, src]);
  return null;
}
