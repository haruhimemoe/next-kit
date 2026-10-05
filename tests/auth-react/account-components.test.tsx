/**
 * @file tests/auth-react/account-components.test.tsx
 * @desc AccountMenu, DeleteAccountForm and createAuthComponents: the menu's three states, the
 *       delete in a dialog: what goes, the typed username, 204, a notice, a refusal and no answer
 *       said in the dialog, focus on the result, and the bound components calling the app's
 *       client and account kit. Ported from pools (AccountMenu, DeleteAccountForm tests).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Oct 5, 2026
 */

// @vitest-environment jsdom

import "../helpers/dialog.js";

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type Account,
  AccountMenu,
  createAuthComponents,
  DeleteAccountForm,
  type OsuSignIn,
} from "../../src/auth-react/index.js";

const { push, replace } = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation.js", () => ({
  usePathname: () => "/search",
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const ITEMS = [
  { href: "/new", label: "Make a pool" },
  { href: "/account", label: "Account" },
];
const PEPPY: Account = {
  status: "signed-in",
  user: { id: "u1", username: "peppy", avatarUrl: "https://a.ppy.sh/2" },
};
const wiring = { items: ITEMS, signOut: vi.fn(async () => undefined), onSignedOut: vi.fn() };

describe("AccountMenu", () => {
  it("shows nothing to press while loading, and sign in (back here) when signed out", () => {
    const { rerender } = render(<AccountMenu account={{ status: "loading" }} {...wiring} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<AccountMenu account={{ status: "signed-out" }} {...wiring} signInLabel="Log in" />);
    expect(screen.getByRole("link", { name: "Log in" }).getAttribute("href")).toBe(
      "/signin?next=%2Fsearch",
    );
  });

  it("opens the avatar menu with the links and Sign out", async () => {
    const { container } = render(<AccountMenu account={PEPPY} {...wiring} />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://a.ppy.sh/2");
    const button = screen.getByRole("button", { name: "peppy" });
    await act(async () => fireEvent.click(button));
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("link", { name: "Make a pool" }).getAttribute("href")).toBe("/new");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Sign out" })));
    expect(wiring.signOut).toHaveBeenCalledOnce();
    expect(wiring.onSignedOut).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("shows no avatar off osu!'s hosts, or as the app decides", () => {
    const other: Account = { ...PEPPY, user: { ...PEPPY.user, avatarUrl: "https://x.test/a" } };
    const { container, rerender } = render(<AccountMenu account={other} {...wiring} />);
    expect(container.querySelector("img")).toBeNull();
    rerender(<AccountMenu account={other} {...wiring} avatarSrc={(url) => url} />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://x.test/a");
  });
});

const renderForm = (onDeleted: () => void, fetcher: typeof fetch) =>
  render(
    <DeleteAccountForm
      username="peppy"
      appName="pools"
      deletes="This deletes your account and every pool you own."
      onDeleted={onDeleted}
      fetcher={fetcher}
      endpoint="/api/me"
    />,
  );

// fireEvent.click doesn't focus its target the way a real click does (that's what
// @testing-library/user-event is for); ConfirmDialog's returnFocus fallback only engages once the
// opener it captured on open is gone, so the trigger must actually hold focus when it opens.
const clickTrigger = (name: string) => {
  const button = screen.getByRole("button", { name });
  fireEvent.click(button);
  button.focus();
};

const confirmDelete = async (onDeleted: () => void, fetcher: typeof fetch) => {
  renderForm(onDeleted, fetcher);
  await act(async () => clickTrigger("Delete my account"));
  fireEvent.change(screen.getByLabelText("Type peppy to confirm"), { target: { value: "peppy" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Delete for good" })));
};

describe("DeleteAccountForm", () => {
  it("opens a dialog that says what goes and waits for the username", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));
    renderForm(vi.fn(), fetcher);
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Delete my account" })),
    );
    const dialog = screen.getByRole("alertdialog", { name: "Delete your account?" });
    const described = document.getElementById(dialog.getAttribute("aria-describedby") ?? "");
    expect(described?.textContent).toBe("This deletes your account and every pool you own.");
    const confirm = screen.getByRole("button", { name: "Delete for good" });
    expect(confirm.getAttribute("aria-disabled")).toBe("true");
    await act(async () => fireEvent.click(confirm));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("sends the username, then signs out and goes home on a 204, focus on what happened", async () => {
    const onDeleted = vi.fn();
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));
    await confirmDelete(onDeleted, fetcher);
    const [url, init] = (fetcher.mock.calls as unknown as [string, RequestInit][])[0] ?? [];
    expect(url).toBe("/api/me");
    expect(init?.method).toBe("DELETE");
    expect(JSON.parse(String(init?.body))).toEqual({ username: "peppy" });
    expect(onDeleted).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith("/");
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("Your account is deleted.");
    expect(document.activeElement).toBe(status);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete my account" })).toBeNull();
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("stays to show the answer's notice, with a link home", async () => {
    const notice = "2 packs will be removed as soon as packs answers.";
    await confirmDelete(vi.fn(), async () => Response.json({ notice }));
    expect(screen.getByRole("status").textContent).toBe(`Your account is deleted. ${notice}`);
    expect(screen.getByRole("link", { name: "Go to the home page" }).getAttribute("href")).toBe(
      "/",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("says a refusal, a bare refusal and no answer in the dialog, and deletes nothing", async () => {
    const onDeleted = vi.fn();
    const answers = [
      Response.json({ error: { message: "Try again later." } }, { status: 503 }),
      new Response("nope", { status: 500 }),
    ];
    const fetcher = vi.fn(async () => {
      const next = answers.shift();
      if (!next) throw new TypeError("offline");
      return next;
    });
    await confirmDelete(onDeleted, fetcher);
    expect(screen.getByRole("alert").textContent).toBe("Try again later.");
    const button = screen.getByRole("button", { name: "Delete for good" });
    await act(async () => fireEvent.click(button));
    expect(screen.getByRole("alert").textContent).toBe("Deleting failed (500).");
    await act(async () => fireEvent.click(button));
    expect(screen.getByRole("alert").textContent).toBe(
      "Couldn't reach pools. Your account is still there.",
    );
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});

describe("createAuthComponents", () => {
  it("binds the client and the account kit", async () => {
    const client = {
      signIn: { social: vi.fn(async (_body: OsuSignIn) => ({ error: null })) },
      signOut: vi.fn(async () => ({})),
    };
    const kit = { useAccount: (): Account => PEPPY, markSignedOut: vi.fn() };
    const ui = createAuthComponents(client, kit);
    render(
      <>
        <ui.SignInWithOsu next="/me" />
        <ui.AccountMenu items={ITEMS} />
        <ui.SignOutButton label="Out" />
        <ui.DeleteAccountForm
          username="peppy"
          appName="bb"
          deletes="Bye."
          fetcher={async () => new Response(null, { status: 204 })}
        />
      </>,
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Sign in with osu!" })),
    );
    expect(client.signIn.social.mock.calls[0]?.[0]).toMatchObject({ callbackURL: "/me" });
    expect(screen.getByRole("button", { name: "peppy" })).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Out" })));
    expect(client.signOut).toHaveBeenCalledOnce();
    expect(kit.markSignedOut).toHaveBeenCalledOnce();
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Delete my account" })),
    );
    fireEvent.change(screen.getByLabelText("Type peppy to confirm"), {
      target: { value: "peppy" },
    });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Delete for good" })));
    expect(kit.markSignedOut).toHaveBeenCalledTimes(2);
  });
});
