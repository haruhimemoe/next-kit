/**
 * @file tests/auth-react/sign-in-out.test.tsx
 * @desc SignInWithOsu, SignOutButton and osuAvatarSrc: the sign-in body and its errors (flat,
 *       nested, thrown), sign-out order and its failure, and the avatar hosts. Ported from packs
 *       and pools (SignInWithOsu, SignOutButton, avatar tests).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OSU_PROVIDER_ID,
  osuAvatarSrc,
  SignInWithOsu,
  SignOutButton,
  signInErrorMessage,
} from "../../src/auth-react/index.js";

const { replace, refresh } = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation.js", () => ({ useRouter: () => ({ replace, refresh }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const press = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
};

describe("SignInWithOsu", () => {
  it("starts osu! sign-in with next kept on the error page, and stays pending", async () => {
    const signIn = vi.fn(async () => ({ data: {} }));
    render(<SignInWithOsu next="/new" signIn={signIn} />);
    await press("Sign in with osu!");
    expect(signIn).toHaveBeenCalledWith({
      provider: OSU_PROVIDER_ID,
      callbackURL: "/new",
      errorCallbackURL: "/signin?next=%2Fnew",
    });
    const button = screen.getByRole("button", { name: "Opening osu!…" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says better-auth's error and lets you try again", async () => {
    const signIn = vi
      .fn()
      .mockResolvedValueOnce({ error: { message: "Too many sign-ins. Wait a minute." } })
      .mockResolvedValueOnce({ error: { status: 500 } });
    render(<SignInWithOsu next="/" signIn={signIn} signInPath="/login" label="Go" />);
    await press("Go");
    expect(screen.getByRole("alert").textContent).toBe("Too many sign-ins. Wait a minute.");
    expect(signIn.mock.calls[0]?.[0].errorCallbackURL).toBe("/login?next=%2F");
    await press("Go");
    expect(screen.getByRole("alert").textContent).toBe("Couldn't start osu! sign-in. Try again.");
  });

  it("says a thrown error, or the failed message", async () => {
    const signIn = vi.fn(async () => {
      throw new Error("offline");
    });
    const { rerender } = render(<SignInWithOsu next="/" signIn={signIn} />);
    await press("Sign in with osu!");
    expect(screen.getByRole("alert").textContent).toBe("offline");
    rerender(
      <SignInWithOsu next="/" signIn={() => Promise.reject(1)} failedMessage="No osu! today." />,
    );
    await press("Sign in with osu!");
    expect(screen.getByRole("alert").textContent).toBe("No osu! today.");
  });

  it("reads flat and nested messages", () => {
    expect(signInErrorMessage({ message: "flat" })).toBe("flat");
    expect(signInErrorMessage({ error: { message: "nested" } })).toBe("nested");
    expect(signInErrorMessage({ message: "" }, "fallback")).toBe("fallback");
    expect(signInErrorMessage(null)).toBe("Couldn't start osu! sign-in. Try again.");
  });
});

describe("SignOutButton", () => {
  it("signs out, then tells the header, then goes home and refreshes", async () => {
    const order: string[] = [];
    const signOut = vi.fn(async () => {
      order.push("signOut");
    });
    const onSignedOut = vi.fn(() => order.push("onSignedOut"));
    render(<SignOutButton signOut={signOut} onSignedOut={onSignedOut} />);
    await press("Sign out");
    expect(order).toEqual(["signOut", "onSignedOut"]);
    expect(replace).toHaveBeenCalledWith("/");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("keeps the marker when sign-out fails, still goes on, with its look and words", async () => {
    const onSignedOut = vi.fn();
    render(
      <SignOutButton
        signOut={() => Promise.reject(new Error("down"))}
        onSignedOut={onSignedOut}
        redirectTo="/bye"
        variant="ghost"
        className="px-3"
        label="Leave"
        pendingLabel="Leaving…"
      />,
    );
    const button = screen.getByRole("button", { name: "Leave" });
    expect(button.className).toContain("px-3");
    await press("Leave");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/bye"));
    expect(onSignedOut).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Leaving…" })).toBeTruthy();
  });
});

describe("osuAvatarSrc", () => {
  it("keeps osu!'s avatars, reads a bare path as osu.ppy.sh's and moves http to https", () => {
    expect(osuAvatarSrc("https://a.ppy.sh/2?1537409912.jpeg")).toBe(
      "https://a.ppy.sh/2?1537409912.jpeg",
    );
    expect(osuAvatarSrc("/images/layout/avatar-guest@2x.png")).toBe(
      "https://osu.ppy.sh/images/layout/avatar-guest@2x.png",
    );
    expect(osuAvatarSrc("http://a.ppy.sh/2")).toBe("https://a.ppy.sh/2");
  });

  it("shows nothing from any other host, port or scheme, or for nothing", () => {
    for (const url of [
      "https://example.com/a.png",
      "//example.com/a.png",
      "https://a.ppy.sh.example.com/2",
      "https://a.ppy.sh:8443/2",
      "http://[::1",
      "data:image/png;base64,AAAA",
      "javascript:alert(1)",
      "",
      null,
      undefined,
    ]) {
      expect(osuAvatarSrc(url)).toBeNull();
    }
  });
});
