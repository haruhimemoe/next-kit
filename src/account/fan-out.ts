/**
 * @file src/account/fan-out.ts
 * @desc The hub side of account fan-out: POST `{ userId }` to every registered app's
 *       /api/internal/account/<op> with that app's own secret, in parallel. Export tries each app
 *       once; delete tries up to 3 times (250 ms, then 1 s between). Only https base URLs are
 *       called, redirects are never followed (a 3xx is a failure, so a bearer can't leave for
 *       another host), and an app whose secret is unset is reported not_configured, not called; for delete
 *       that stops every app (the rest report skipped), so nothing is half deleted.
 *       exportBundle packs the identity record and each app's data into one JSON object.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { ACCOUNT_PATH, type AccountApp, type AccountOp, appUrl, secretFor } from "./registry.js";

/** Each request's timeout by default. */
export const FAN_OUT_TIMEOUT_MS = 10_000;
/** The waits between delete tries: three tries in all. */
export const DELETE_RETRY_DELAYS_MS: readonly number[] = Object.freeze([250, 1000]);

/** One app's outcome. status is 0 when no answer came (not configured, refused URL, network). */
export type FanOutResult = {
  id: string;
  ok: boolean;
  status: number;
  data?: unknown;
  error?: string;
};

/** fanOut's options. */
export type FanOutOptions = {
  apps: readonly AccountApp[];
  op: AccountOp;
  userId: string;
  /** Where the apps' secrets live (process.env). */
  env: Record<string, string | undefined>;
  fetcher?: typeof fetch;
  /** Per request (default FAN_OUT_TIMEOUT_MS). */
  timeoutMs?: number;
  /** Test seam for the retry waits. */
  sleep?: (ms: number) => Promise<void>;
};

/** What fanOut gives back: ok only when every app answered 2xx. */
export type FanOutReport = { ok: boolean; results: FanOutResult[] };

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Call = Omit<FanOutOptions, "apps" | "sleep"> & { app: AccountApp; secret: string; url: URL };

const callOnce = async ({ app, op, userId, secret, url, fetcher = fetch, timeoutMs }: Call) => {
  const failed = (status: number, error: string): FanOutResult => ({
    id: app.id,
    ok: false,
    status,
    error,
  });
  let res: Response;
  try {
    res = await fetcher(url, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify({ userId }),
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs ?? FAN_OUT_TIMEOUT_MS),
    });
  } catch {
    return failed(0, "unreachable");
  }
  if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
    return failed(res.status, "redirect");
  }
  if (!res.ok) return failed(res.status, "app_error");
  if (op === "delete") return { id: app.id, ok: true, status: res.status };
  try {
    return { id: app.id, ok: true, status: res.status, data: await res.json() };
  } catch {
    return failed(res.status, "bad_json");
  }
};

/**
 * @function fanOut
 * @param options {FanOutOptions} the registry, the op, the user, env, and test seams
 * @returns {Promise<FanOutReport>} one result per app in registry order; ok when all succeeded
 */
export const fanOut = async ({
  apps,
  sleep = wait,
  ...rest
}: FanOutOptions): Promise<FanOutReport> => {
  const tries = rest.op === "delete" ? DELETE_RETRY_DELAYS_MS.length + 1 : 1;
  const targets = apps.map((app) => {
    const secret = secretFor(app, rest.env);
    const url = appUrl(app, `${ACCOUNT_PATH}/${rest.op}`);
    const error = !secret ? "not_configured" : !url ? "insecure_url" : null;
    return { app, secret, url, error };
  });
  // Delete is all or nothing: one unusable app means no app is called, so no data goes partly.
  const refuse = rest.op === "delete" && targets.some((target) => target.error);
  const results = await Promise.all(
    targets.map(async ({ app, secret, url, error }): Promise<FanOutResult> => {
      if (error || !secret || !url) {
        return { id: app.id, ok: false, status: 0, error: error ?? "not_configured" };
      }
      if (refuse) return { id: app.id, ok: false, status: 0, error: "skipped" };
      let result = await callOnce({ ...rest, app, secret, url });
      for (let attempt = 1; !result.ok && attempt < tries; attempt++) {
        await sleep(DELETE_RETRY_DELAYS_MS[attempt - 1] ?? 0);
        result = await callOnce({ ...rest, app, secret, url });
      }
      return result;
    }),
  );
  return { ok: results.every((result) => result.ok), results };
};

/** The download a person gets from "Download my data". */
export type ExportBundle = {
  exportedAt: string;
  identity: unknown;
  apps: Record<string, unknown>;
};

/**
 * @function exportBundle
 * @param identity {unknown} the hub's own record of the user (no tokens)
 * @param results {readonly FanOutResult[]} an export fanOut's results
 * @param now {() => number} clock (default Date.now)
 * @returns {ExportBundle} each app's data by id, or `{ error }` for an app that didn't answer
 */
export const exportBundle = (
  identity: unknown,
  results: readonly FanOutResult[],
  now: () => number = Date.now,
): ExportBundle => ({
  exportedAt: new Date(now()).toISOString(),
  identity,
  apps: Object.fromEntries(
    results.map((result) => [result.id, result.ok ? result.data : { error: result.error }]),
  ),
});
