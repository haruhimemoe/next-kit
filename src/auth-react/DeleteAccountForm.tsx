/**
 * @file src/auth-react/DeleteAccountForm.tsx
 * @desc "Delete my account": a button that opens ui's ConfirmDialog (no confirm()), where what
 *       goes is the description and the osu! username is typed before "Delete for good" sends one
 *       DELETE with it to the app's endpoint. 204 means gone: signed out, the page says so and
 *       goes home. Another 2xx is gone too but stays, to show the answer's `notice` (work still
 *       waiting elsewhere). A refusal says the server's message in the dialog, no answer says the
 *       app couldn't be reached, nothing was deleted and the dialog stays open. Once it's gone
 *       the button never comes back and focus lands on the line that says so.
 *       Moved from pools and bb (src/components/account/DeleteAccountForm.tsx).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import { buttonClasses, ConfirmDialog } from "@haruhimemoe/ui";
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
 * @returns {ReactNode} the "Delete my account" trigger and its confirm dialog, or what happened
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
  const doneId = `${useId()}-done`;
  // Once it's gone: what more to say. The button doesn't come back, so no second delete.
  const [done, setDone] = useState<string | null>(null);
  const unreachable = `Couldn't reach ${appName}. Your account is still there.`;
  // Throws to keep the dialog open with what went wrong.
  const remove = async () => {
    let response: Response;
    try {
      response = await fetcher(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
    } catch {
      throw new Error(unreachable);
    }
    if (!response.ok) throw new Error(await messageOf(response));
    onDeleted();
    if (response.status === 204) {
      setDone("");
      router.push(homeHref);
      return;
    }
    const body = (await response.json().catch(() => ({}))) as { notice?: unknown };
    setDone(typeof body.notice === "string" ? body.notice : "");
  };
  if (done !== null) {
    return (
      <div className="flex flex-col gap-3">
        <p id={doneId} role="status" tabIndex={-1} className="text-c2 text-sm outline-none">
          {`Your account is deleted. ${done}`.trim()}
        </p>
        {/* A full load home: nothing of the deleted account stays in the page. */}
        <a href={homeHref} className={buttonClasses({ variant: "secondary" })}>
          {homeLabel}
        </a>
      </div>
    );
  }
  return (
    <ConfirmDialog
      trigger="Delete my account"
      triggerProps={{ variant: "danger" }}
      title="Delete your account?"
      description={deletes}
      tone="destructive"
      typeToConfirm={username}
      confirmLabel="Delete for good"
      pendingLabel="Deleting…"
      failedMessage={(error) => (error instanceof Error ? error.message : unreachable)}
      returnFocus={() => document.getElementById(doneId)}
      onConfirm={remove}
    />
  );
}
