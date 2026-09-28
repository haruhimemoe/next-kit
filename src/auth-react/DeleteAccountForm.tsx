/**
 * @file src/auth-react/DeleteAccountForm.tsx
 * @desc "Delete my account". The confirmation is built into the page (ui's TypeToConfirm, no
 *       confirm() dialog): the button stays off until the osu! username is typed exactly, then
 *       one DELETE to the app's endpoint carries it. 204 means gone: signed out, the page says
 *       so and goes home. Another 2xx is gone too but stays, to show the answer's `notice` (work
 *       still waiting elsewhere). A refusal says the server's message, and no answer says the app
 *       couldn't be reached; nothing was deleted. The form never comes back once it's gone.
 *       Moved from pools and bb (src/components/account/DeleteAccountForm.tsx).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { buttonClasses, TypeToConfirm } from "@haruhimemoe/ui";
import { useRouter } from "next/navigation.js";
import { type ReactNode, useId, useState } from "react";

/** DeleteAccountForm's props. */
export type DeleteAccountFormProps = {
  /** The signed-in osu! username, typed to confirm and sent as `{ username }`. */
  username: string;
  /** The app's name, for "Couldn't reach <appName>. Your account is still there." */
  appName: string;
  /** What goes, above the field ("This deletes your account and every pool you own…"). */
  deletes: ReactNode;
  /** Runs once the account is gone (markSignedOut); createAuthComponents binds it. */
  onDeleted: () => void;
  /** The DELETE endpoint (default "/api/account"). */
  endpoint?: string | undefined;
  /** Where to go after (default "/"). */
  homeHref?: string | undefined;
  /** The link home's text once deleted (default "Go to the home page"). */
  homeLabel?: ReactNode;
  /** Test seam (default: fetch). */
  fetcher?: typeof fetch | undefined;
};

const messageOf = async (response: Response): Promise<string> => {
  const fallback = `Deleting failed (${response.status}).`;
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
};

/**
 * @function DeleteAccountForm
 * @param props {DeleteAccountFormProps} the username, the app's name, what goes, the endpoint
 *        and what to do after
 * @returns {ReactNode} the typed-name confirmation, or what happened
 */
export function DeleteAccountForm({
  username,
  appName,
  deletes,
  onDeleted,
  endpoint = "/api/account",
  homeHref = "/",
  homeLabel = "Go to the home page",
  fetcher = fetch,
}: DeleteAccountFormProps): ReactNode {
  const router = useRouter();
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  // Once it's gone: what more to say. The form doesn't come back, so no second delete.
  const [done, setDone] = useState<string | null>(null);
  const remove = async () => {
    setError(null);
    try {
      const response = await fetcher(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      if (!response.ok) {
        setError(await messageOf(response));
        return;
      }
      onDeleted();
      if (response.status === 204) {
        setDone("");
        router.push(homeHref);
        return;
      }
      const body = (await response.json().catch(() => ({}))) as { notice?: unknown };
      setDone(typeof body.notice === "string" ? body.notice : "");
    } catch {
      setError(`Couldn't reach ${appName}. Your account is still there.`);
    }
  };
  if (done !== null) {
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="text-c2 text-sm">
          {`Your account is deleted. ${done}`.trim()}
        </p>
        {/* A full load home: nothing of the deleted account stays in the page. */}
        <a
          href={homeHref}
          className={buttonClasses({ variant: "secondary", className: "self-start" })}
        >
          {homeLabel}
        </a>
      </div>
    );
  }
  return (
    <TypeToConfirm
      id={id}
      expected={username}
      submitLabel="Delete my account"
      pendingLabel="Deleting…"
      error={error}
      onConfirm={remove}
    >
      <p className="text-c2 text-sm">{deletes}</p>
    </TypeToConfirm>
  );
}
