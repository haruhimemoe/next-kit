/**
 * @file src/inbox/types.ts
 * @desc The inbox's shapes. Structural on purpose: an invite's own document is whatever the app
 *       sends (like an @haruhimemoe/invites invite), so next-kit depends on no invites package.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

/** An invite as an app sends it: the app comes from its secret, never from the body. */
export type InviteDraft = {
  /** The app's own invite id; the inbox key. */
  id: string;
  /** osu! id of who sent it. */
  from: number;
  /** osu! id of who it's for. */
  to: number;
  /** The app's state name, like "pending" or "accepted". */
  state: string;
  expiresAt?: Date;
  /** The app's full invite, stored as sent. */
  doc: Record<string, unknown>;
};

/** An invite as the inbox holds it. */
export type StoredInvite = InviteDraft & { app: string; updatedAt?: Date };

/** A notification as an app sends it. */
export type NotificationDraft = {
  /** The identity user it's for (24-hex). */
  userId: string;
  app: string;
  /** The app's kind name, like "invite" or "pack_comment". */
  kind: string;
  title: string;
  /** Where it leads: a path or an https URL. */
  href?: string | undefined;
};

/** A notification as an inbox page shows it. */
export type Notification = {
  id: string;
  userId: string;
  app: string;
  kind: string;
  title: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};
