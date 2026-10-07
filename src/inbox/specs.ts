/**
 * @file src/inbox/specs.ts
 * @desc The inbox's collections and indexes in the identity database: invites (by recipient and
 *       by sender, newest first) and notifications (a person's unread first, newest first, gone
 *       after 90 days). buildIdentityIndexes builds them from 0.14.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import type { IndexSpec } from "../mongo/indexes.js";

/** The inbox's collections in identity. */
export const INBOX_COLLECTIONS = Object.freeze({
  invite: "invite",
  notification: "notification",
} as const);

/** Notifications go this long after they're made. */
export const NOTIFICATION_TTL_SECONDS = 90 * 24 * 60 * 60;

/** The inbox's index specs. */
export const inboxIndexSpecs: readonly IndexSpec[] = Object.freeze([
  {
    collection: INBOX_COLLECTIONS.invite,
    key: { to: 1, state: 1, updatedAt: -1 },
    name: "inbox_invite_to",
  },
  {
    collection: INBOX_COLLECTIONS.invite,
    key: { from: 1, state: 1, updatedAt: -1 },
    name: "inbox_invite_from",
  },
  {
    collection: INBOX_COLLECTIONS.notification,
    key: { userId: 1, readAt: 1, createdAt: -1 },
    name: "inbox_notification_user",
  },
  {
    collection: INBOX_COLLECTIONS.notification,
    key: { createdAt: 1 },
    name: "inbox_notification_ttl",
    expireAfterSeconds: NOTIFICATION_TTL_SECONDS,
  },
]);
