/**
 * @file src/inbox/store.ts
 * @desc The inbox store over the identity database: invites (upserted by the app's id, each held
 *       by one app) and notifications (unread filter, mark read, gone after 90 days). Only the
 *       hub writes; satellites post writes through createInboxClient and may read identity with
 *       their read-only user. deleteFor is for account delete.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { type Db, ObjectId } from "mongodb";
import { USER_ID_PATTERN } from "../account/registry.js";
import { isDuplicateKeyError } from "../mongo/duplicate.js";
import { INBOX_COLLECTIONS } from "./specs.js";
import type { Notification, NotificationDraft, StoredInvite } from "./types.js";

/** notificationsFor's default and largest page. */
export const NOTIFICATION_LIMIT = Object.freeze({ default: 50, max: 100 });
/** invitesFor gives at most this many, newest first. */
export const INVITE_LIMIT = 100;

/** What createInboxStore returns. */
export type InboxStore = {
  /** Upserts by id; false when another app holds that id (nothing written). */
  putInvite: (invite: StoredInvite) => Promise<boolean>;
  /** Invites sent to or by that osu! id. */
  invitesFor: (osuId: number) => Promise<StoredInvite[]>;
  /** Stores one; gives its id. */
  notify: (draft: NotificationDraft) => Promise<string>;
  notificationsFor: (
    userId: string,
    options?: { unreadOnly?: boolean; limit?: number },
  ) => Promise<Notification[]>;
  /** Marks that user's notifications read; gives how many changed. */
  markRead: (userId: string, ids: readonly string[]) => Promise<number>;
  /** Removes the user's notifications and every invite to or from their osu! id. */
  deleteFor: (userId: string, osuId: number) => Promise<number>;
};

type InviteDoc = Omit<StoredInvite, "id"> & { _id: string; updatedAt: Date };
type NotificationDoc = {
  _id: ObjectId;
  userId: ObjectId;
  app: string;
  kind: string;
  title: string;
  href?: string;
  readAt?: Date;
  createdAt: Date;
};

const objectId = (id: string): ObjectId | null =>
  USER_ID_PATTERN.test(id) ? new ObjectId(id) : null;

const toInvite = ({ _id, ...rest }: InviteDoc): StoredInvite => ({ id: _id, ...rest });

const toNotification = (doc: NotificationDoc): Notification => ({
  id: doc._id.toHexString(),
  userId: doc.userId.toHexString(),
  app: doc.app,
  kind: doc.kind,
  title: doc.title,
  href: doc.href ?? null,
  readAt: doc.readAt ? doc.readAt.toISOString() : null,
  createdAt: doc.createdAt.toISOString(),
});

/**
 * @function createInboxStore
 * @param identityDb {() => Promise<Db>} the hub's identity database
 * @param now {() => number} clock (default Date.now)
 * @returns {InboxStore} the store
 */
export const createInboxStore = (
  identityDb: () => Promise<Db>,
  now: () => number = Date.now,
): InboxStore => {
  const invites = async () => (await identityDb()).collection<InviteDoc>(INBOX_COLLECTIONS.invite);
  const notifications = async () =>
    (await identityDb()).collection<NotificationDoc>(INBOX_COLLECTIONS.notification);

  return {
    async putInvite({ id, app, from, to, state, expiresAt, doc }) {
      const fields = { from, to, state, doc, updatedAt: new Date(now()) };
      try {
        // The filter carries the app: another app's id can't match, so the upsert's insert
        // hits the _id and fails with E11000 instead of overwriting.
        await (await invites()).updateOne(
          { _id: id, app },
          {
            $set: { ...fields, ...(expiresAt ? { expiresAt } : {}) },
            ...(expiresAt ? {} : { $unset: { expiresAt: "" } }),
          },
          { upsert: true },
        );
        return true;
      } catch (error) {
        if (isDuplicateKeyError(error)) return false;
        throw error;
      }
    },
    async invitesFor(osuId) {
      const found = await (await invites())
        .find({ $or: [{ to: osuId }, { from: osuId }] })
        .sort({ updatedAt: -1 })
        .limit(INVITE_LIMIT)
        .toArray();
      return found.map(toInvite);
    },
    async notify({ userId, app, kind, title, href }) {
      const owner = objectId(userId);
      if (!owner) throw new TypeError("notify: userId must be a 24-character hex id.");
      const _id = new ObjectId();
      await (await notifications()).insertOne({
        _id,
        userId: owner,
        app,
        kind,
        title,
        ...(href ? { href } : {}),
        createdAt: new Date(now()),
      });
      return _id.toHexString();
    },
    async notificationsFor(userId, { unreadOnly = false, limit } = {}) {
      const owner = objectId(userId);
      if (!owner) return [];
      const size = Math.min(
        Math.max(1, limit ?? NOTIFICATION_LIMIT.default),
        NOTIFICATION_LIMIT.max,
      );
      const found = await (await notifications())
        .find({ userId: owner, ...(unreadOnly ? { readAt: { $exists: false } } : {}) })
        .sort({ createdAt: -1 })
        .limit(size)
        .toArray();
      return found.map(toNotification);
    },
    async markRead(userId, ids) {
      const owner = objectId(userId);
      const targets = ids.map(objectId).filter((id): id is ObjectId => id !== null);
      if (!owner || targets.length === 0) return 0;
      const result = await (await notifications()).updateMany(
        { _id: { $in: targets }, userId: owner, readAt: { $exists: false } },
        { $set: { readAt: new Date(now()) } },
      );
      return result.modifiedCount;
    },
    async deleteFor(userId, osuId) {
      const owner = objectId(userId);
      const removed = await Promise.all([
        owner ? (await notifications()).deleteMany({ userId: owner }) : { deletedCount: 0 },
        (await invites()).deleteMany({ $or: [{ to: osuId }, { from: osuId }] }),
      ]);
      return removed.reduce((sum, result) => sum + result.deletedCount, 0);
    },
  };
};
