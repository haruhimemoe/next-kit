/**
 * @file src/auth-react/use-account.ts
 * @desc The React side of the account store: useAccount (loading during server render), and
 *       createAccount, which wires a store to a better-auth client and the app's marker cookie
 *       the way packs and pools each did at the bottom of src/hooks/useAccount.ts.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { createElement, type ReactNode, useSyncExternalStore } from "react";
import {
  type Account,
  type AccountStore,
  createAccountStore,
  LOADING,
  type SessionData,
} from "./account-store.js";
import type { SignedInMarker } from "./marker.js";
import { RestoreSignedIn } from "./RestoreSignedIn.js";

/** The part of a better-auth client the store calls. */
export type SessionClient = {
  getSession: () => Promise<{ data?: unknown; error?: unknown }>;
};

/**
 * @function sessionFetcher
 * @param client {SessionClient} the app's better-auth client
 * @returns {() => Promise<SessionData | null>} a getSession that throws better-auth's error
 */
export const sessionFetcher = (client: SessionClient) => async (): Promise<SessionData | null> => {
  const { data, error } = await client.getSession();
  if (error) throw error;
  return (data as SessionData | null | undefined) ?? null;
};

/**
 * @function useAccount
 * @param store {AccountStore} the page-wide store
 * @returns {Account} current account state ("loading" during server render)
 */
export const useAccount = (store: AccountStore): Account =>
  useSyncExternalStore(store.subscribe, store.getSnapshot, () => LOADING);

/** RestoreSignedIn with the store and marker already bound: what a server page can render. */
export type BoundRestoreProps = { next?: string; pending?: ReactNode };

/** What createAccount returns: the store, and the hook, sign-out and component bound to it. */
export type AccountKit = {
  store: AccountStore;
  useAccount: () => Account;
  markSignedOut: () => void;
  RestoreSignedIn: (props: BoundRestoreProps) => ReactNode;
};

/**
 * @function createAccount
 * @param client {SessionClient} the app's better-auth client
 * @param marker {SignedInMarker} the app's signed-in marker
 * @returns {AccountKit} a page-wide store reading document.cookie, with its hook, sign-out and
 *          RestoreSignedIn (export them from the app's own "use client" module, so server pages
 *          render <RestoreSignedIn next={next} /> with only serializable props)
 */
export const createAccount = (client: SessionClient, marker: SignedInMarker): AccountKit => {
  const store = createAccountStore({
    getSession: sessionFetcher(client),
    readCookie: () => document.cookie,
    hasMarker: marker.has,
    clearMarker: () => marker.clear(),
  });
  return {
    store,
    useAccount: () => useAccount(store),
    markSignedOut: () => store.markSignedOut(),
    RestoreSignedIn: (props) =>
      createElement(RestoreSignedIn, { ...props, store, hasMarker: marker.has }),
  };
};
