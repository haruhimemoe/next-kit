/**
 * @file src/inbox/index.ts
 * @desc @haruhimemoe/next-kit/inbox: invites and notifications in the identity database. The
 *       hub owns the store and the POST route; satellites write through createInboxClient with
 *       their account fan-out secret. Server only.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

export { type AppMatch, matchApp } from "./auth.js";
export {
  createInboxClient,
  INBOX_PATH,
  type InboxClient,
  type InboxClientOptions,
} from "./client.js";
export { createInboxRoutes, INBOX_MAX_BODY_BYTES, type InboxRoutesOptions } from "./routes.js";
export { INBOX_COLLECTIONS, inboxIndexSpecs, NOTIFICATION_TTL_SECONDS } from "./specs.js";
export {
  createInboxStore,
  INVITE_LIMIT,
  type InboxStore,
  NOTIFICATION_LIMIT,
} from "./store.js";
export type { InviteDraft, Notification, NotificationDraft, StoredInvite } from "./types.js";
