/**
 * @file src/auth-react/SignInWithOsu.tsx
 * @desc "Sign in with osu!": starts the OAuth redirect through the app's better-auth client, then
 *       lands on `next`, or back on /signin?next=<next>&error=<code> when osu! says no. A call
 *       that can't start says so under the button (role="alert") and lets the visitor try again.
 *       Styled with @haruhimemoe/ui. Moved from packs and pools
 *       (src/components/auth/SignInWithOsu.tsx), where only the error reading differed.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { Button } from "@haruhimemoe/ui";
import { type ReactNode, useState } from "react";
import { type OsuSignIn, osuSignIn } from "./sign-in.js";

/** The better-auth call that starts sign-in (`(body) => authClient.signIn.social(body)`). */
export type StartSignIn = (body: OsuSignIn) => Promise<unknown>;

/** SignInWithOsu's props. */
export type SignInWithOsuProps = {
  /** Where to land after signing in (already checked with safeNextPath). */
  next: string;
  /** Starts sign-in; createAuthComponents binds the app's client. */
  signIn: StartSignIn;
  /** The sign-in page errors come back to (default /signin). */
  signInPath?: string | undefined;
  /** The button's text (default "Sign in with osu!"). */
  label?: ReactNode;
  /** The button's text while osu! opens (default "Opening osu!…"). */
  pendingLabel?: ReactNode;
  /** Said when sign-in can't start and the error has no message. */
  failedMessage?: string | undefined;
};

const FAILED = "Couldn't start osu! sign-in. Try again.";

/**
 * @function signInErrorMessage
 * @param error {unknown} better-auth's error (`{ message }`, or `{ error: { message } }`)
 * @param fallback {string} said when it carries no message
 * @returns {string} the message to show
 */
export const signInErrorMessage = (error: unknown, fallback: string = FAILED): string => {
  if (typeof error !== "object" || error === null) return fallback;
  const { message, error: nested } = error as { message?: unknown; error?: { message?: unknown } };
  if (typeof message === "string" && message) return message;
  if (typeof nested?.message === "string" && nested.message) return nested.message;
  return fallback;
};

/**
 * @function SignInWithOsu
 * @param props {SignInWithOsuProps} `next`, the sign-in call, and the words
 * @returns {ReactNode} the large "Sign in with osu!" button, with an alert when it can't start
 */
export function SignInWithOsu({
  next,
  signIn,
  signInPath,
  label = "Sign in with osu!",
  pendingLabel = "Opening osu!…",
  failedMessage = FAILED,
}: SignInWithOsuProps): ReactNode {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onClick = async () => {
    setPending(true);
    setError(null);
    try {
      // better-auth adds &error=<code> to the error URL; /signin explains it and keeps `next`.
      const result = (await signIn(osuSignIn(next, signInPath))) as { error?: unknown } | null;
      if (!result?.error) return;
      setError(signInErrorMessage(result.error, failedMessage));
    } catch (cause) {
      setError(signInErrorMessage(cause, failedMessage));
    }
    setPending(false);
  };
  return (
    <div className="flex flex-col items-center gap-2">
      <Button size="lg" onClick={onClick} disabled={pending}>
        {pending ? pendingLabel : label}
      </Button>
      {error ? (
        <p role="alert" className="font-bold text-rose-300 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
