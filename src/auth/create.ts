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
 *
 *       0.12: the hub passes cookieDomain (".haruhime.moe") to put every better-auth cookie,
 *       including OAuth state and PKCE, on the parent domain (better-auth's
 *       advanced.crossSubDomainCookies). That's acceptable only because every OAuth flow starts
 *       and ends on the hub; satellites never redirect through OAuth and never pass
 *       cookieDomain. trustedOrigins is passed straight through to better-auth, for the
 *       satellite origins the hub's sign-in and callback may redirect back to. The session is
 *       now 30 days with a 1-day updateAge (createSessionReader pings the hub to refresh it for
 *       satellite-only visitors).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Tue Oct 6, 2026
 */

import { type BetterAuthOptions, betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { createAuthMiddleware } from "better-auth/api";
import { genericOAuth } from "better-auth/plugins";
import type { Db, MongoClient } from "mongodb";
import { markerMaxAge } from "../auth-react/marker.js";
import { DEFAULT_SIGN_IN_PATH } from "../server/safe-next.js";
import {
  IDENTITY_USER_FIELDS,
  OSU_PROVIDER_ID,
  OSU_USER_FIELDS,
  osuProvider,
  withoutTokens,
} from "./osu.js";

/** Extra fields on user rows, as better-auth's user.additionalFields takes them. */
export type UserFields = NonNullable<NonNullable<BetterAuthOptions["user"]>["additionalFields"]>;

/** No extra user fields. */
type NoFields = Record<never, never>;

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

/** How long a session lasts, and how often it extends on a get-session: 30 days, refreshed
 * once a day. Satellites that only see a request every few days still extend it, through
 * createSessionReader's ping to the hub. */
export const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 30;
export const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24;

/** createOsuAuth's options. */
export type OsuAuthOptions<F extends UserFields = NoFields> = {
  /** The osu! OAuth app. */
  clientId: string;
  clientSecret: string;
  /** BETTER_AUTH_URL and BETTER_AUTH_SECRET. */
  baseURL: string;
  secret: string;
  /** The app's database, and the client it's on (for the adapter). */
  db: Db;
  client: MongoClient;
  /** The signed-in marker cookie's name, like "pools-signed-in" (0.11 apps) or
   * SHARED_MARKER_COOKIE (the hub, 0.12). */
  markerCookie: string;
  /** The hub only: puts every better-auth cookie (session, OAuth state, PKCE) on this parent
   * domain, like ".haruhime.moe". Leave unset for a single-DB app's own cookies. */
  cookieDomain?: string;
  /** The satellite origins the hub's sign-in and OAuth callback may redirect back to. Passed
   * straight through to better-auth's trustedOrigins. */
  trustedOrigins?: string[];
  /** Where errors with no page to return to land (default /signin). */
  signInPath?: string;
  hooks?: OsuAuthHooks;
  /** Fields of the app's own on user rows (packs: `system`, set only by the server). */
  userFields?: F;
};

/** Runs a guard: false refuses the write, anything else lets it through unchanged. */
const guard =
  (check: ((row: AuthRow) => Promise<boolean | undefined>) | undefined) =>
  async (row: AuthRow): Promise<false | undefined> =>
    check && (await check(row)) === false ? false : undefined;

/**
 * @function createOsuAuth
 * @param options {OsuAuthOptions<F>} osu! credentials, better-auth URL and secret, the
 *        database, the marker cookie, the cookie domain and trusted origins (hub only), the
 *        sign-in page, the hooks and extra user fields
 * @returns the better-auth instance (use `typeof` it with inferAdditionalFields on the client)
 */
export const createOsuAuth = <F extends UserFields = NoFields>({
  clientId,
  clientSecret,
  baseURL,
  secret,
  db,
  client,
  markerCookie,
  cookieDomain,
  trustedOrigins,
  signInPath = DEFAULT_SIGN_IN_PATH,
  hooks = {},
  userFields,
}: OsuAuthOptions<F>) => {
  const markerOptions = {
    path: "/",
    sameSite: "lax" as const,
    secure: baseURL.startsWith("https://"),
    httpOnly: false,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  };
  const beforeUser = guard(hooks.beforeUserCreate);
  const beforeAccount = guard(hooks.beforeAccountCreate);
  const beforeSession = guard(hooks.beforeSessionCreate);
  return betterAuth({
    baseURL,
    secret,
    trustedOrigins,
    database: mongodbAdapter(db, { client, transaction: false }),
    // These fields must accept input: better-auth 1.7 drops `input: false` fields from the OAuth
    // profile too. So no client may call /update-user: identity only ever comes from osu!.
    disabledPaths: ["/update-user"],
    session: {
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
    },
    advanced: {
      crossSubDomainCookies: cookieDomain
        ? { enabled: true as const, domain: cookieDomain }
        : { enabled: false as const },
    },
    account: {
      // `<osuId>@osu.local` belongs to whoever osu! says has that id.
      accountLinking: { trustedProviders: [OSU_PROVIDER_ID], requireLocalEmailVerified: false },
    },
    onAPIError: { errorURL: new URL(signInPath, baseURL).toString() },
    user: {
      additionalFields: { ...OSU_USER_FIELDS, ...IDENTITY_USER_FIELDS, ...userFields } as typeof OSU_USER_FIELDS &
        typeof IDENTITY_USER_FIELDS &
        F,
    },
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

/** The instance createOsuAuth builds (with no extra user fields). */
export type OsuAuth = ReturnType<typeof createOsuAuth<NoFields>>;
