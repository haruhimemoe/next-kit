/**
 * @file src/inbox/client.ts
 * @desc The satellite side of the inbox: posts invite and notification writes to the hub's
 *       /api/internal/inbox with the app's own secret (ACCOUNT_FANOUT_SECRET). Reads go straight
 *       to identity with the app's read-only user. Redirects are never followed; a non-2xx
 *       answer throws.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import type { InviteDraft, NotificationDraft } from "./types.js";

/** Where the hub serves the inbox. */
export const INBOX_PATH = "/api/internal/inbox";

/** createInboxClient's options. */
export type InboxClientOptions = {
  /** The hub's origin, like "https://www.haruhime.moe" (HUB_URL). */
  hubUrl: string;
  /** This app's secret, the same one the hub keeps for it. */
  secret: string;
  fetcher?: typeof fetch;
};

/** What createInboxClient returns. */
export type InboxClient = {
  putInvite: (invite: InviteDraft) => Promise<void>;
  /** Gives the new notification's id. */
  notify: (draft: Omit<NotificationDraft, "app">) => Promise<string>;
};

/**
 * @function createInboxClient
 * @param options {InboxClientOptions} the hub URL, the secret and a test seam
 * @returns {InboxClient} writes that throw an Error naming the status when the hub refuses
 */
export const createInboxClient = ({
  hubUrl,
  secret,
  fetcher = fetch,
}: InboxClientOptions): InboxClient => {
  const url = new URL(INBOX_PATH, hubUrl);
  const send = async (body: unknown): Promise<Response> => {
    const res = await fetcher(url, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      redirect: "manual",
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`inbox: the hub answered ${res.status}`);
    return res;
  };
  return {
    async putInvite({ expiresAt, ...invite }) {
      await send({
        op: "putInvite",
        invite: { ...invite, ...(expiresAt ? { expiresAt: expiresAt.toISOString() } : {}) },
      });
    },
    async notify(notification) {
      const res = await send({ op: "notify", notification });
      return ((await res.json()) as { id: string }).id;
    },
  };
};
