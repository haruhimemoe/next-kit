/**
 * @file tests/auth-react/restore-signed-in.test.tsx
 * @desc RestoreSignedIn and osuSignIn: the component cases packs and pools both had
 *       (tests/components/auth/RestoreSignedIn.test.tsx), with the store and marker check as
 *       props, and pools' sign-in body that keeps `next` on an error.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSignedInMarker,
  OSU_PROVIDER_ID,
  osuSignIn,
  RestoreSignedIn,
  safeNextPath,
} from "../../src/auth-react/index.js";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation.js", () => ({ useRouter: () => ({ replace }) }));

const { has } = createSignedInMarker("pools-signed-in");
const store = () => ({ recheck: vi.fn(async () => undefined) });

afterEach(() => {
  cleanup();
  replace.mockClear();
});

describe("RestoreSignedIn", () => {
  it("rechecks the session, then continues to next", async () => {
    const fake = store();
    render(<RestoreSignedIn next="/account" store={fake} hasMarker={has} readCookie={() => ""} />);
    expect(screen.getByText("Signing you in…")).toBeTruthy();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/account"));
    expect(fake.recheck).toHaveBeenCalledOnce();
  });

  it("shows the app's own pending content", () => {
    render(<RestoreSignedIn next="/me" store={store()} hasMarker={has} pending={<b>Wait</b>} />);
    expect(screen.getByText("Wait")).toBeTruthy();
  });

  it("rechecks quietly on a signed-in page when the marker is missing", async () => {
    const fake = store();
    const { container } = render(
      <RestoreSignedIn store={fake} hasMarker={has} readCookie={() => ""} />,
    );
    await waitFor(() => expect(fake.recheck).toHaveBeenCalledOnce());
    expect(container.innerHTML).toBe("");
  });

  it("does nothing on a signed-in page when the marker is already there", () => {
    const fake = store();
    render(<RestoreSignedIn store={fake} hasMarker={has} readCookie={() => "pools-signed-in=1"} />);
    expect(fake.recheck).not.toHaveBeenCalled();
  });

  it("reads document.cookie by default, and never navigates after unmounting", async () => {
    let finish = () => {};
    const slow = { recheck: vi.fn(() => new Promise<void>((resolve) => (finish = resolve))) };
    const { unmount } = render(<RestoreSignedIn next="/account" store={slow} hasMarker={has} />);
    unmount();
    finish();
    await Promise.resolve();
    expect(slow.recheck).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("osuSignIn", () => {
  it("lands on next, and comes back to the sign-in page with next on an error", () => {
    expect(osuSignIn("/p/abc?x=1")).toEqual({
      provider: OSU_PROVIDER_ID,
      callbackURL: "/p/abc?x=1",
      errorCallbackURL: "/signin?next=%2Fp%2Fabc%3Fx%3D1",
    });
    expect(osuSignIn("/me", "/login").errorCallbackURL).toBe("/login?next=%2Fme");
  });

  it("is safe to use from the browser entry point", () => {
    expect(safeNextPath("//evil", { fallback: "/me" })).toBe("/me");
  });
});
