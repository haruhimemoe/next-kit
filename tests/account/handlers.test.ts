/**
 * @file tests/account/handlers.test.ts
 * @desc createAccountHandlers: method, unset secret, missing and wrong bearer, bad userId,
 *       export 200 JSON, delete 204 twice, a throwing callback, and failure counting.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { describe, expect, it, vi } from "vitest";
import { createAccountHandlers } from "../../src/account/handlers.js";

const SECRET = "p".repeat(32);
const USER = "0123456789abcdef01234567";
const deleted: string[] = [];
const handlers = createAccountHandlers({
  secret: () => SECRET,
  export: async (userId) => ({ packs: [{ ownerId: userId }] }),
  delete: async (userId) => {
    deleted.push(userId);
  },
});

const call = (
  op: "export" | "delete",
  body: unknown = { userId: USER },
  auth: string | null = `Bearer ${SECRET}`,
  method = "POST",
) =>
  handlers[op](
    new Request(`https://packs.test/api/internal/account/${op}`, {
      method,
      headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
      ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
    }),
  );

describe("createAccountHandlers", () => {
  it("answers 401 without the bearer or with another app's", async () => {
    expect((await call("export", undefined, null)).status).toBe(401);
    const wrong = await call("export", undefined, `Bearer ${"q".repeat(32)}`);
    expect(wrong.status).toBe(401);
    expect(wrong.headers.get("cache-control")).toBe("no-store");
  });

  it("answers 503 while the secret is unset or short", async () => {
    const off = createAccountHandlers({ secret: "short", export: vi.fn(), delete: vi.fn() });
    const res = await off.delete(new Request("https://p.test", { method: "POST" }));
    expect(res.status).toBe(503);
  });

  it("refuses other methods and a bad userId", async () => {
    expect((await call("export", undefined, undefined, "GET")).status).toBe(405);
    expect((await call("export", { userId: "nope" })).status).toBe(400);
    expect((await call("export", { userId: USER, extra: 1 })).status).toBe(400);
  });

  it("exports as 200 JSON, no-store", async () => {
    const res = await call("export");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ packs: [{ ownerId: USER }] });
  });

  it("deletes with 204, and again with 204", async () => {
    expect((await call("delete")).status).toBe(204);
    expect((await call("delete")).status).toBe(204);
    expect(deleted.slice(-2)).toEqual([USER, USER]);
  });

  it("answers 500 when the app's callback throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const broken = createAccountHandlers({
      secret: SECRET,
      export: async () => {
        throw new Error("db down");
      },
      delete: vi.fn(),
    });
    const res = await broken.export(
      new Request("https://p.test", {
        method: "POST",
        headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json" },
        body: JSON.stringify({ userId: USER }),
      }),
    );
    expect(res.status).toBe(500);
    error.mockRestore();
  });

  it("counts failures when asked", async () => {
    const hit = vi.fn(async () => ({ allowed: false, limit: 1, remaining: 0, resetAt: 0 }));
    const limited = createAccountHandlers({
      secret: SECRET,
      export: vi.fn(),
      delete: vi.fn(),
      failures: {
        limiter: { hit } as never,
        rule: { scope: "account-fail", limit: 1, windowSeconds: 60 },
      },
    });
    const res = await limited.export(new Request("https://p.test", { method: "POST" }));
    expect(res.status).toBe(429);
    expect(hit).toHaveBeenCalledOnce();
  });
});
