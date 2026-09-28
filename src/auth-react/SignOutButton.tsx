/**
 * @file src/auth-react/SignOutButton.tsx
 * @desc Signs out, forgets the signed-in marker once the session is really gone (so the header
 *       flips without a reload), then goes home and refreshes server components. A failed
 *       sign-out still goes home, marker kept. Styled with @haruhimemoe/ui. Moved from packs and
 *       pools (src/components/auth/SignOutButton.tsx).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { Button, type ButtonVariant } from "@haruhimemoe/ui";
import { useRouter } from "next/navigation.js";
import { type ReactNode, useState } from "react";

/** SignOutButton's props. */
export type SignOutButtonProps = {
  /** Ends the session (`() => authClient.signOut()`); createAuthComponents binds it. */
  signOut: () => Promise<unknown>;
  /** Runs once the session is gone (the account kit's markSignedOut). */
  onSignedOut: () => void;
  /** Where to go after (default "/"). */
  redirectTo?: string | undefined;
  /** The button's look (default "secondary"). */
  variant?: ButtonVariant | undefined;
  /** Classes for the button. */
  className?: string | undefined;
  /** The button's text (default "Sign out"). */
  label?: ReactNode;
  /** The button's text while signing out (default "Signing out…"). */
  pendingLabel?: ReactNode;
};

/**
 * @function SignOutButton
 * @param props {SignOutButtonProps} the sign-out call, what to do after, where to go, the look
 * @returns {ReactNode} a button that signs out, tells the header, and goes to `redirectTo`
 */
export function SignOutButton({
  signOut,
  onSignedOut,
  redirectTo = "/",
  variant = "secondary",
  className,
  label = "Sign out",
  pendingLabel = "Signing out…",
}: SignOutButtonProps): ReactNode {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const onClick = async () => {
    setPending(true);
    await signOut().then(onSignedOut, () => undefined);
    router.replace(redirectTo);
    router.refresh();
  };
  return (
    <Button variant={variant} className={className} onClick={onClick} disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
