/**
 * @file tests/auth-react/use-account.test.tsx
 * @desc createAccountStore and useAccount: the test file packs and pools both had
 *       (tests/components/hooks/useAccount.test.tsx), with the marker check passed in, plus
 *       createAccount and sessionFetcher over a fake better-auth client.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  type AccountDeps,
  createAccount,
  createAccountStore,
  createSignedInMarker,
  sessionFetcher,
  useAccount,
} from "../../src/auth-react/index.js";

const USER = { id: "u1", username: "peppy", avatarUrl: null };
const marker = createSignedInMarker("pools-signed-in");

const deps = (overrides: Partial<AccountDeps> = {}): AccountDeps => ({
  getSession: vi.fn(async () => ({ user: USER })),
  readCookie: () => "pools-signed-in=1",
  hasMarker: marker.has,
  clearMarker: vi.fn(),
  ...overrides,
});
describe("useAccount", () => {
  it("is signed out at once, with no request, without the marker", () => {
    const d = deps({ readCookie: () => "other=1" });
    const store = createAccountStore(d);
    const { result } = renderHook(() => useAccount(store));
    expect(result.current).toEqual({ status: "signed-out" });
    expect(d.getSession).not.toHaveBeenCalled();
  });

  it("asks once and exposes the user when the marker is present", async () => {
    const d = deps();
    const store = createAccountStore(d);
    const { result } = renderHook(() => useAccount(store));
    renderHook(() => useAccount(store));
    expect(result.current).toEqual({ status: "loading" });
    await waitFor(() => expect(result.current).toEqual({ status: "signed-in", user: USER }));
    expect(d.getSession).toHaveBeenCalledOnce();
  });

  it("clears a stale marker when the server has no session", async () => {
    const d = deps({ getSession: vi.fn(async () => null) });
    const store = createAccountStore(d);
    const { result } = renderHook(() => useAccount(store));
    await waitFor(() => expect(result.current).toEqual({ status: "signed-out" }));
    expect(d.clearMarker).toHaveBeenCalledOnce();
  });

  it("is signed out when the session request fails", async () => {
    const d = deps({ getSession: vi.fn(async () => Promise.reject(new Error("500"))) });
    const store = createAccountStore(d);
    const { result } = renderHook(() => useAccount(store));
    await waitFor(() => expect(result.current).toEqual({ status: "signed-out" }));
  });

  it("flips to signed out and clears the marker on markSignedOut", async () => {
    const d = deps();
    const store = createAccountStore(d);
    const { result } = renderHook(() => useAccount(store));
    await waitFor(() => expect(result.current.status).toBe("signed-in"));
    act(() => store.markSignedOut());
    expect(result.current).toEqual({ status: "signed-out" });
    expect(d.clearMarker).toHaveBeenCalledOnce();
  });

  it("rechecks on request even without the marker (a session from before the marker existed)", async () => {
    const d = deps({ readCookie: () => "" });
    const store = createAccountStore(d);
    const { result } = renderHook(() => useAccount(store));
    expect(result.current).toEqual({ status: "signed-out" });
    await act(() => store.recheck());
    expect(result.current).toEqual({ status: "signed-in", user: USER });
    expect(d.getSession).toHaveBeenCalledOnce();
  });

  it("catches up with a sign-out in another tab when this one is shown again", async () => {
    let cookie = "pools-signed-in=1";
    const d = deps({ readCookie: () => cookie });
    const store = createAccountStore(d);
    const { result } = renderHook(() => useAccount(store));
    await waitFor(() => expect(result.current.status).toBe("signed-in"));
    cookie = "";
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current).toEqual({ status: "signed-out" });
  });

  it("catches up with a sign-in in another tab when this one is shown again", async () => {
    let cookie = "";
    const d = deps({ readCookie: () => cookie });
    const store = createAccountStore(d);
    const { result } = renderHook(() => useAccount(store));
    expect(result.current).toEqual({ status: "signed-out" });
    cookie = "pools-signed-in=1";
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(result.current).toEqual({ status: "signed-in", user: USER }));
    expect(d.getSession).toHaveBeenCalledOnce();
  });

  it("asks nothing on tab switches when nothing changed", async () => {
    const d = deps({ readCookie: () => "" });
    const store = createAccountStore(d);
    renderHook(() => useAccount(store));
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(d.getSession).not.toHaveBeenCalled();
  });
});

describe("sessionFetcher", () => {
  it("returns the session, null for none, and throws better-auth's error", async () => {
    expect(await sessionFetcher({ getSession: async () => ({ data: { user: USER } }) })()).toEqual({
      user: USER,
    });
    expect(await sessionFetcher({ getSession: async () => ({ data: null }) })()).toBeNull();
    expect(await sessionFetcher({ getSession: async () => ({}) })()).toBeNull();
    const failing = sessionFetcher({ getSession: async () => ({ error: new Error("403") }) });
    await expect(failing()).rejects.toThrow("403");
  });
});

describe("createAccount", () => {
  it("wires a store to the client and the document's marker", async () => {
    // biome-ignore lint/suspicious/noDocumentCookie: sets the marker as the server's Set-Cookie would
    document.cookie = "kit-signed-in=1; Path=/";
    const getSession = vi.fn(async () => ({ data: { user: { ...USER, avatarUrl: "a" } } }));
    const kit = createAccount({ getSession }, createSignedInMarker("kit-signed-in"));
    const { result } = renderHook(() => kit.useAccount());
    await waitFor(() => expect(result.current.status).toBe("signed-in"));
    expect(kit.store.getSnapshot()).toEqual({
      status: "signed-in",
      user: { ...USER, avatarUrl: "a" },
    });
    act(() => kit.markSignedOut());
    expect(result.current).toEqual({ status: "signed-out" });
    expect(document.cookie).not.toContain("kit-signed-in=1");
  });

  it("ignores a visibility change while the tab is hidden", async () => {
    const d = deps();
    const store = createAccountStore(d);
    const { result } = renderHook(() => useAccount(store));
    await waitFor(() => expect(result.current.status).toBe("signed-in"));
    const hidden = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    d.readCookie = () => "";
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    hidden.mockRestore();
    expect(result.current.status).toBe("signed-in");
  });

  it("stops telling a listener after it unsubscribes", () => {
    const store = createAccountStore(deps({ readCookie: () => "" }));
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    expect(listener).toHaveBeenCalledOnce();
    listener.mockClear();
    unsubscribe();
    store.markSignedOut();
    expect(listener).not.toHaveBeenCalled();
  });
});
