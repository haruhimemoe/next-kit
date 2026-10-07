/**
 * @file src/inbox/routes.ts
 * @desc The hub's POST /api/internal/inbox: satellites write invites and notifications here, so
 *       identity stays read-only for them. The bearer picks the app (matchApp); the body never
 *       names one (a strict schema refuses an `app` key). An invite id another app holds is a
 *       409. Every answer is no-store.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { z } from "zod";
import { type AccountApp, USER_ID_PATTERN } from "../account/registry.js";
import { parseJsonBody } from "../server/body.js";
import { clientIp, rateLimitSubject } from "../server/client-ip.js";
import { jsonError, noStore } from "../server/errors.js";
import type { BearerFailureLimit } from "../server/machine-auth.js";
import { bearerToken } from "../server/machine-auth.js";
import { tooManyRequests } from "../server/rate-limit.js";
import { matchApp } from "./auth.js";
import type { InboxStore } from "./store.js";

/** The inbox route's body cap. */
export const INBOX_MAX_BODY_BYTES = 32_768;

const name = z.string().regex(/^[a-z0-9_-]{1,64}$/);
const osuId = z.number().int().positive().max(2_147_483_647);
const href = z
  .string()
  .max(512)
  .refine((v) => !/[\\\s]/.test(v), { message: "href can't hold backslashes or spaces." })
  .refine((v) => (v.startsWith("/") && !v.startsWith("//")) || v.startsWith("https://"), {
    message: "href must be a path or an https URL.",
  });

const BODY = z.discriminatedUnion("op", [
  z.strictObject({
    op: z.literal("putInvite"),
    invite: z.strictObject({
      id: z.string().min(1).max(128),
      from: osuId,
      to: osuId,
      state: name,
      expiresAt: z.iso.datetime().optional(),
      doc: z.record(z.string(), z.unknown()),
    }),
  }),
  z.strictObject({
    op: z.literal("notify"),
    notification: z.strictObject({
      userId: z.string().regex(USER_ID_PATTERN),
      kind: name,
      title: z.string().min(1).max(200),
      href: href.optional(),
    }),
  }),
]);

/** createInboxRoutes' options. */
export type InboxRoutesOptions = {
  store: InboxStore;
  /** The same registry and secrets as account fan-out. */
  apps: readonly AccountApp[];
  env: Record<string, string | undefined>;
  /** Counts a missing or wrong secret per IP (429 past the limit). */
  failures?: BearerFailureLimit;
};

/**
 * @function createInboxRoutes
 * @param options {InboxRoutesOptions} the store, the registry, env and failure counting
 * @returns {{ post: (req: Request) => Promise<Response> }} 503 while no app has a secret, 401 (or
 *          429) without a matching one, 400 for a bad body, 409 for another app's invite id,
 *          then 204 (putInvite) or 201 `{ id }` (notify)
 */
export const createInboxRoutes = ({ store, apps, env, failures }: InboxRoutesOptions) => ({
  post: async (req: Request): Promise<Response> => {
    const match = matchApp(bearerToken(req.headers), apps, env);
    if (!match.app) {
      if (!match.configured) {
        return noStore(jsonError(503, "The inbox isn't set up on this server.", "not_configured"));
      }
      if (failures) {
        const hit = await failures.limiter.hit(
          failures.rule,
          rateLimitSubject(clientIp(req.headers)),
        );
        if (!hit.allowed) return noStore(tooManyRequests(hit));
      }
      return noStore(jsonError(401, "Not authorized."));
    }
    const app = match.app.id;
    const body = await parseJsonBody(req, BODY, { maxBytes: INBOX_MAX_BODY_BYTES });
    if (!body.ok) return noStore(body.response);
    if (body.data.op === "notify") {
      const id = await store.notify({ ...body.data.notification, app });
      return noStore(Response.json({ id }, { status: 201 }));
    }
    const { expiresAt, ...invite } = body.data.invite;
    const stored = await store.putInvite({
      ...invite,
      app,
      ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
    });
    return noStore(
      stored
        ? new Response(null, { status: 204 })
        : jsonError(409, "Another app holds that invite id."),
    );
  },
});
