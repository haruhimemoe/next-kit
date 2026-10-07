/**
 * @file src/account/handlers.ts
 * @desc The satellite side of account fan-out: POST /api/internal/account/{export,delete}, called
 *       only by the hub with the app's own bearer secret (ACCOUNT_FANOUT_SECRET). Body
 *       `{ userId }` (a 24-hex identity user id). Export answers 200 with the app's JSON-safe
 *       data; delete answers 204 and must be idempotent. Every answer is no-store.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { z } from "zod";
import { parseJsonBody } from "../server/body.js";
import { jsonError, noStore } from "../server/errors.js";
import { type BearerFailureLimit, refuseWithoutBearer } from "../server/machine-auth.js";
import { USER_ID_PATTERN, usableSecret } from "./registry.js";

/** createAccountHandlers' options. */
export type AccountHandlersOptions = {
  /** ACCOUNT_FANOUT_SECRET, or a reader for it; under 32 bytes counts as unset (503). */
  secret: string | undefined | (() => string | undefined);
  /** The user's data in this app, JSON-safe. */
  export: (userId: string) => Promise<unknown>;
  /** Removes the user's data in this app; running it twice must be fine. */
  delete: (userId: string) => Promise<void>;
  /** Counts a missing or wrong secret per IP (429 past the limit). */
  failures?: BearerFailureLimit;
};

/** What createAccountHandlers returns: one POST handler per op. */
export type AccountHandlers = {
  export: (req: Request) => Promise<Response>;
  delete: (req: Request) => Promise<Response>;
};

const BODY = z.strictObject({
  userId: z.string().regex(USER_ID_PATTERN, "userId must be a 24-character hex id."),
});

/**
 * @function createAccountHandlers
 * @param options {AccountHandlersOptions} the secret, the app's export and delete, failure counting
 * @returns {AccountHandlers} POST handlers: 405 for other methods, 503 while the secret is unset,
 *          401 without it, 400 for a bad body, then 200 JSON (export) or 204 (delete); a throw in
 *          the app's callback is logged and answers 500
 */
export const createAccountHandlers = (options: AccountHandlersOptions): AccountHandlers => {
  const read = options.secret;
  const secret = () => usableSecret(typeof read === "function" ? read() : read);
  const handle =
    (op: "export" | "delete") =>
    async (req: Request): Promise<Response> => {
      if (req.method !== "POST") return noStore(jsonError(405, "Use POST.", "method_not_allowed"));
      const refused = await refuseWithoutBearer(req, {
        secret,
        label: "account",
        notConfigured: "Account fan-out isn't set up on this server.",
        ...(options.failures ? { failures: options.failures } : {}),
        noStore: true,
      });
      if (refused) return refused;
      const body = await parseJsonBody(req, BODY);
      if (!body.ok) return noStore(body.response);
      try {
        if (op === "delete") {
          await options.delete(body.data.userId);
          return noStore(new Response(null, { status: 204 }));
        }
        return noStore(Response.json(await options.export(body.data.userId)));
      } catch (error) {
        console.error(`[account] ${op} failed`, error);
        return noStore(jsonError(500, `Couldn't ${op} that account's data.`));
      }
    };
  return { export: handle("export"), delete: handle("delete") };
};
