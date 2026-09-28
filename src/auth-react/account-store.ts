/**
 * @file src/auth-react/account-store.ts
 * @desc Who is signed in, for a header's account menu. The store asks the server only when the
 *       readable signed-in marker is present, once per page load, so anonymous visitors cost no
 *       request; another tab signing in or out is caught up when this one is shown again, at a
 *       request only when the marker changed. markSignedOut() updates every subscriber at once.
 *       Moved from packs and pools (src/hooks/useAccount.ts, body-identical).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

/** The account as the page sees it. */
export type Account =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; user: { id: string; username: string; avatarUrl: string | null } };

/** The part of a better-auth session the store reads. */
export type SessionData = {
  user: { id: string; username: string; avatarUrl?: string | null };
};

/** What the store needs: a session fetch, a cookie read and a marker clear (tests pass fakes). */
export type AccountDeps = {
  getSession: () => Promise<SessionData | null>;
  readCookie: () => string;
  hasMarker: (cookieHeader: string) => boolean;
  clearMarker: () => void;
};

/** A useSyncExternalStore store of the account. */
export type AccountStore = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => Account;
  markSignedOut: () => void;
  /** Ask the server even without the marker (pages that know the user is signed in). */
  recheck: () => Promise<void>;
};

/** Before the first answer, and during server render. */
export const LOADING: Account = Object.freeze({ status: "loading" });
const SIGNED_OUT: Account = Object.freeze({ status: "signed-out" });

/**
 * @function createAccountStore
 * @param deps {AccountDeps} session fetch, cookie read, marker check and clear
 * @returns {AccountStore} starts on the first subscription
 */
export const createAccountStore = ({
  getSession,
  readCookie,
  hasMarker,
  clearMarker,
}: AccountDeps): AccountStore => {
  let state: Account = LOADING;
  let started = false;
  const listeners = new Set<() => void>();
  const set = (next: Account) => {
    state = next;
    for (const listener of listeners) listener();
  };
  // Asks the server; a session there also (re)sets the marker cookie.
  const load = (): Promise<void> =>
    getSession().then(
      (data) => {
        if (!data) {
          clearMarker();
          set(SIGNED_OUT);
          return;
        }
        const { id, username, avatarUrl } = data.user;
        set({ status: "signed-in", user: { id, username, avatarUrl: avatarUrl ?? null } });
      },
      () => set(SIGNED_OUT),
    );
  const sync = () => {
    if (document.visibilityState === "hidden") return;
    const marked = hasMarker(readCookie());
    if (!marked && state.status === "signed-in") set(SIGNED_OUT);
    else if (marked && state.status === "signed-out") void load();
  };
  const start = () => {
    if (started) return;
    started = true;
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", sync);
    if (!hasMarker(readCookie())) {
      set(SIGNED_OUT);
      return;
    }
    void load();
  };
  return {
    subscribe: (listener) => {
      listeners.add(listener);
      start();
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => state,
    markSignedOut: () => {
      clearMarker();
      set(SIGNED_OUT);
    },
    recheck: () => {
      started = true;
      return load();
    },
  };
};
