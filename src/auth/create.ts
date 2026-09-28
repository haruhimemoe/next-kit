/**
 * @file src/auth/create.ts
 * @desc createOsuAuth: better-auth on MongoDB with osu! as the only way in. Identity only ever
 *       comes from osu! (/update-user is disabled), osu! tokens are never kept, and osu! is a
 *       trusted provider for account linking: a user row whose osu! link is gone (a deletion
 *       that stopped halfway) is relinked on the next osu! sign-in, which is safe because the
 *       only way to a user row is osu! itself. A failure with no page to return to lands on the
 *       sign-in page with ?error=<code>. The readable signed-in marker cookie follows the
 *       session: set with it, cleared on sign-out or a get-session that finds none. The app's
 *       hooks guard user, account and session creation. Moved from pools (src/lib/auth.ts);
 *       packs lacked accountLinking and onAPIError.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { createAuthMiddleware } from "better-auth/api";
import { genericOAuth } from "better-auth/plugins";
import type { Db, MongoClient } from "mongodb";
import { markerMaxAge } from "../auth-react/marker.js";
import { DEFAULT_SIGN_IN_PATH } from "../server/safe-next.js";
import { OSU_PROVIDER_ID, OSU_USER_FIELDS, osuProvider, withoutTokens } from "./osu.js";

/** A database row as a hook sees it. */
export type AuthRow = Record<string, unknown>;

/** Guards and follow-ups on better-auth's writes. A guard returning false refuses the write. */
export type OsuAuthHooks = {
  /** Before a user row is written (osu! profile already mapped). */
  beforeUserCreate?: (user: AuthRow) => Promise<boolean | undefined>;
  /** After a user row is written; a throw is logged and never fails the sign-in. */
  afterUserCreate?: (user: AuthRow) => Promise<void>;
  /** Before an osu! account link is written (tokens already dropped). */
  beforeAccountCreate?: (account: AuthRow) => Promise<boolean | undefined>;
  /** Before a session is written (packs: system accounts never sign in). */
  beforeSessionCreate?: (session: AuthRow) => Promise<boolean | undefined>;
};

/** createOsuAuth's options. */
export type OsuAuthOptions = {
  /** The osu! OAuth app. */
  clientId: string;
  clientSecret: string;
  /** BETTER_AUTH_URL and BETTER_AUTH_SECRET. */
  baseURL: string;
  secret: string;
  /** The app's database, and the client it's on (for the adapter). */
  db: Db;
  client: MongoClient;
  /** The signed-in marker cookie's name, like "pools-signed-in". */
  markerCookie: string;
  /** Where errors with no page to return to land (default /signin). */
  signInPath?: string;
  hooks?: OsuAuthHooks;
};

/** Runs a guard: false refuses the write, anything else lets it through unchanged. */
const guard =
  (check: ((row: AuthRow) => Promise<boolean | undefined>) | undefined) =>
  async (row: AuthRow): Promise<false | undefined> =>
    check && (await check(row)) === false ? false : undefined;

/**
 * @function createOsuAuth
 * @param options {OsuAuthOptions} osu! credentials, better-auth URL and secret, the database,
 *        the marker cookie, the sign-in page and the hooks
 * @returns the better-auth instance (use `typeof` it with inferAdditionalFields on the client)
 */
export const createOsuAuth = ({
  clientId,
  clientSecret,
  baseURL,
  secret,
  db,
  client,
  markerCookie,
  signInPath = DEFAULT_SIGN_IN_PATH,
  hooks = {},
}: OsuAuthOptions) => {
  const markerOptions = {
    path: "/",
    sameSite: "lax" as const,
    secure: baseURL.startsWith("https://"),
    httpOnly: false,
  };
  const beforeUser = guard(hooks.beforeUserCreate);
  const beforeAccount = guard(hooks.beforeAccountCreate);
  const beforeSession = guard(hooks.beforeSessionCreate);
  return betterAuth({
    baseURL,
    secret,
    database: mongodbAdapter(db, { client, transaction: false }),
    // These fields must accept input: better-auth 1.7 drops `input: false` fields from the OAuth
    // profile too. So no client may call /update-user: identity only ever comes from osu!.
    disabledPaths: ["/update-user"],
    account: {
      // `<osuId>@osu.local` belongs to whoever osu! says has that id.
      accountLinking: { trustedProviders: [OSU_PROVIDER_ID], requireLocalEmailVerified: false },
    },
    onAPIError: { errorURL: new URL(signInPath, baseURL).toString() },
    user: { additionalFields: OSU_USER_FIELDS },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => beforeUser(user),
          after: async (user) => {
            try {
              await hooks.afterUserCreate?.(user);
            } catch (error) {
              console.error("[auth] afterUserCreate failed", error);
            }
          },
        },
      },
      account: {
        create: {
          before: async (account) =>
            (await beforeAccount(account)) === false ? false : { data: withoutTokens(account) },
        },
        update: { before: async (account) => ({ data: withoutTokens(account) }) },
      },
      session: { create: { before: async (session) => beforeSession(session) } },
    },
    hooks: {
      // Keep the readable marker in step with the session, so pages without it never ask for
      // the session at all.
      after: createAuthMiddleware(async (ctx) => {
        const set = (expiresAt: Date | string) =>
          ctx.setCookie(markerCookie, "1", { ...markerOptions, maxAge: markerMaxAge(expiresAt) });
        const clear = () => ctx.setCookie(markerCookie, "", { ...markerOptions, maxAge: 0 });
        const created = ctx.context.newSession;
        if (created) {
          set(created.session.expiresAt);
        } else if (ctx.path === "/sign-out") {
          clear();
        } else if (ctx.path === "/get-session") {
          const returned = ctx.context.returned as {
            session?: { expiresAt: Date | string };
          } | null;
          if (returned?.session) set(returned.session.expiresAt);
          else clear();
        }
      }),
    },
    plugins: [genericOAuth({ config: [osuProvider({ clientId, clientSecret })] })],
  });
};

/** The instance createOsuAuth builds. */
export type OsuAuth = ReturnType<typeof createOsuAuth>;
