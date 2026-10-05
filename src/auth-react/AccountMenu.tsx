/**
 * @file src/auth-react/AccountMenu.tsx
 * @desc The header's account area. Client-side, so static pages stay static and read no cookies:
 *       the account comes from the app's useAccount, which asks only when the signed-in marker is
 *       there. Nothing to press while loading; "Sign in" (back to this page) when signed out;
 *       signed in, ui's HeaderMenu: the avatar (a plain img, so the app's CSP img-src must allow
 *       osu!'s avatar hosts) and name, the app's links, and Sign out. Escape,
 *       a click outside or on a link, or focus leaving it closes it. Moved from pools and bb
 *       (src/components/layout/AccountMenu.tsx), which differed only in the links.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import { HeaderMenu, type HeaderMenuItem, textClasses } from "@haruhimemoe/ui";
import { usePathname } from "next/navigation.js";
import type { ReactNode } from "react";
import { DEFAULT_SIGN_IN_PATH, signInHref } from "../server/safe-next.js";
import type { Account } from "./account-store.js";
import { osuAvatarSrc } from "./avatar.js";
import { SignOutButton } from "./SignOutButton.js";

/** AccountMenu's props. */
export type AccountMenuProps = {
  /** The account (the app's useAccount()); createAuthComponents binds it. */
  account: Account;
  /** The menu's links, top to bottom; Sign out comes after them. */
  items: readonly HeaderMenuItem[];
  /** Ends the session; createAuthComponents binds it. */
  signOut: () => Promise<unknown>;
  /** Runs once the session is gone (markSignedOut); createAuthComponents binds it. */
  onSignedOut: () => void;
  /** Where the avatar is shown from, or null for none (default osuAvatarSrc). */
  avatarSrc?: ((url: string | null) => string | null) | undefined;
  /** The sign-in page (default /signin). */
  signInPath?: string | undefined;
  /** The sign-in link's text (default "Sign in"). */
  signInLabel?: ReactNode;
  /** The sign-out button's text (default "Sign out"). */
  signOutLabel?: ReactNode;
  /** Where sign-out goes (default "/"). */
  signOutRedirect?: string | undefined;
};

/**
 * @function AccountMenu
 * @param props {AccountMenuProps} the account, the links, the sign-out wiring and the words
 * @returns {ReactNode} a sized blank while loading, the sign-in link when signed out, else the
 *          avatar menu with the links and Sign out
 */
export function AccountMenu({
  account,
  items,
  signOut,
  onSignedOut,
  avatarSrc = osuAvatarSrc,
  signInPath = DEFAULT_SIGN_IN_PATH,
  signInLabel = "Sign in",
  signOutLabel,
  signOutRedirect,
}: AccountMenuProps): ReactNode {
  const pathname = usePathname();
  if (account.status === "loading") return <span aria-hidden="true" className="block h-7 w-16" />;
  if (account.status === "signed-out") {
    return (
      // A plain link: the sign-in page loads on its own anyway, and it keeps next/link (CommonJS)
      // out of this entry point.
      <a
        href={signInHref(pathname || "/", signInPath)}
        className={textClasses({
          tone: "muted",
          bold: true,
          className: "transition-colors hover:text-c1",
        })}
      >
        {signInLabel}
      </a>
    );
  }
  const avatar = avatarSrc(account.user.avatarUrl);
  return (
    <HeaderMenu
      label={
        <>
          {avatar ? (
            // biome-ignore lint/performance/noImgElement: 28px needs no resizing, and next/image would need each app's image config.
            <img src={avatar} alt="" width={28} height={28} className="rounded-full" />
          ) : null}
          <span>{account.user.username}</span>
        </>
      }
      items={items}
    >
      <SignOutButton
        signOut={signOut}
        onSignedOut={onSignedOut}
        redirectTo={signOutRedirect}
        label={signOutLabel}
        variant="ghost"
        className="h-auto justify-start rounded px-3 py-2"
      />
    </HeaderMenu>
  );
}
