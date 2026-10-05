/**
 * @file src/auth-react/RestoreSignedIn.tsx
 * @desc For pages that know on the server that the visitor is signed in (the sign-in page with a
 *       session, an account page): if this browser has no signed-in marker (a session from before
 *       the marker existed, or a cleared cookie), ask for the session once, which sets the marker
 *       and fixes the header. With `next`, the sign-in page then continues there. Moved from packs
 *       and pools (src/components/auth/RestoreSignedIn.tsx, body-identical).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import { Text } from "@haruhimemoe/ui";
import { useRouter } from "next/navigation.js";
import { type ReactNode, useEffect } from "react";

/** RestoreSignedIn's props. */
export type RestoreSignedInProps = {
  /** The page-wide account store (createAccount's `store`). */
  store: { recheck: () => Promise<void> };
  /** The app's marker check (createSignedInMarker's `has`). */
  hasMarker: (cookieHeader: string) => boolean;
  /** Where to go once the session is restored (the sign-in page's `next`). */
  next?: string;
  /** Shown while it goes on to `next`. */
  pending?: ReactNode;
  /** Test seam (default: document.cookie). */
  readCookie?: () => string;
};

const readDocumentCookie = () => document.cookie;

const SIGNING_IN = <Text tone="muted">Signing you in…</Text>;

/**
 * @function RestoreSignedIn
 * @param props {RestoreSignedInProps} the store, the marker check, `next` and what to show
 * @returns {ReactNode} nothing without `next`; `pending` while it goes on to `next`
 */
export function RestoreSignedIn({
  store,
  hasMarker,
  next,
  pending = SIGNING_IN,
  readCookie = readDocumentCookie,
}: RestoreSignedInProps): ReactNode {
  const router = useRouter();

  useEffect(() => {
    if (next === undefined && hasMarker(readCookie())) return;
    let live = true;
    store.recheck().then(() => {
      if (live && next !== undefined) router.replace(next);
    });
    return () => {
      live = false;
    };
  }, [next, store, hasMarker, readCookie, router]);

  return next === undefined ? null : pending;
}
