/**
 * @file tests/server/body.test.ts
 * @desc parseJsonBody and parseIdList: packs' and pools' own cases (tests/unit/lib/api.test.ts),
 *       with pools' strict id rules.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { MAX_BODY_BYTES, parseIdList, parseJsonBody } from "../../src/server/index.js";

const schema = z.object({ name: z.string().min(1, "Name the pack."), n: z.number().default(1) });
const strict = z.strictObject({ hidden: z.boolean() });

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/x", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });

const errorOf = async (result: Awaited<ReturnType<typeof parseJsonBody>>) => {
  if (result.ok) throw new Error("expected a failure");
  return { status: result.response.status, body: await result.response.json() };
};

describe("parseJsonBody", () => {
  it("parses valid JSON with the schema's defaults", async () => {
    expect(await parseJsonBody(post('{"name":"F"}'), schema)).toEqual({
      ok: true,
      data: { name: "F", n: 1 },
    });
  });

  it("accepts a charset on the content type", async () => {
    const request = post('{"name":"F"}', { "content-type": "application/json; charset=utf-8" });
    expect((await parseJsonBody(request, schema)).ok).toBe(true);
  });

  it("refuses anything that isn't JSON with 415", async () => {
    const plain = new Request("http://localhost/api/x", { method: "POST", body: "name=F" });
    expect(await errorOf(await parseJsonBody(plain, schema))).toEqual({
      status: 415,
      body: { error: { code: "unsupported_media_type", message: "Send the request as JSON." } },
    });
    const text = post('{"hidden":true}', { "content-type": "text/plain" });
    expect((await errorOf(await parseJsonBody(text, strict))).status).toBe(415);
  });

  it("refuses a body over the cap with 413", async () => {
    const big = JSON.stringify({ name: "x".repeat(MAX_BODY_BYTES) });
    expect(await errorOf(await parseJsonBody(post(big), schema))).toEqual({
      status: 413,
      body: { error: { code: "too_large", message: "That request is too large." } },
    });
  });

  it("refuses a declared oversized body with 413 before reading it", async () => {
    const request = post('{"name":"F"}', { "content-length": String(MAX_BODY_BYTES + 1) });
    const read = vi.spyOn(request, "text");
    expect((await errorOf(await parseJsonBody(request, schema))).status).toBe(413);
    expect(read).not.toHaveBeenCalled();
  });

  it("refuses broken JSON with 400", async () => {
    expect(await errorOf(await parseJsonBody(post("{"), schema))).toEqual({
      status: 400,
      body: { error: { code: "bad_request", message: "That request wasn't valid JSON." } },
    });
  });

  it("reports the first schema problem with 400", async () => {
    expect(await errorOf(await parseJsonBody(post('{"name":""}'), schema))).toEqual({
      status: 400,
      body: { error: { code: "bad_request", message: "Name the pack." } },
    });
  });

  it("refuses unknown keys with a strict schema", async () => {
    const result = await parseJsonBody(post('{"hidden":true,"extra":1}'), strict);
    expect((await errorOf(result)).status).toBe(400);
  });

  it("says what was too large when the route names it", async () => {
    const big = JSON.stringify({ name: "x".repeat(MAX_BODY_BYTES) });
    const tooLarge = "That magnet link is too long.";
    expect(await errorOf(await parseJsonBody(post(big), schema, { tooLarge }))).toEqual({
      status: 413,
      body: { error: { code: "too_large", message: tooLarge } },
    });
  });

  it("takes a route's own cap", async () => {
    const loose = z.object({ hidden: z.boolean() });
    const body = JSON.stringify({ hidden: true, pad: "x".repeat(20_000) });
    expect((await parseJsonBody(post(body), loose, { maxBytes: 32_768 })).ok).toBe(true);
    const tooBig = JSON.stringify({ hidden: true, pad: "x".repeat(33_000) });
    const result = await parseJsonBody(post(tooBig), loose, { maxBytes: 32_768 });
    expect((await errorOf(result)).status).toBe(413);
  });

  it("sends the code a refinement names in its params", async () => {
    const named = z.strictObject({
      name: z.string().refine((text) => text !== "bad", {
        message: "That fails the content filter.",
        params: { code: "content_filter" },
      }),
    });
    expect(await errorOf(await parseJsonBody(post('{"name":"bad"}'), named))).toEqual({
      status: 400,
      body: { error: { code: "content_filter", message: "That fails the content filter." } },
    });
    const numbered = z.string().refine(() => false, { message: "No.", params: { code: 7 } });
    const plain = await errorOf(await parseJsonBody(post('"x"'), numbered));
    expect(plain.body).toEqual({ error: { code: "bad_request", message: "No." } });
  });

  it("falls back to a generic message when zod gives no issue", async () => {
    const empty = {
      safeParse: () => ({ success: false, error: { issues: [] } }),
    } as unknown as z.ZodType;
    expect(await errorOf(await parseJsonBody(post("{}"), empty))).toEqual({
      status: 400,
      body: { error: { code: "bad_request", message: "That request isn't valid." } },
    });
  });
});

describe("parseIdList", () => {
  const max = 64;

  it("keeps the ids in the order sent", () => {
    expect(parseIdList("3,1,2", { max })).toEqual([3, 1, 2]);
    expect(parseIdList("75,129891", { max })).toEqual([75, 129891]);
  });

  it("accepts a full list", () => {
    const ids = Array.from({ length: max }, (_, i) => i + 1);
    expect(parseIdList(ids.join(","), { max })).toEqual(ids);
  });

  it.each([
    null,
    "",
    "abc",
    "0",
    "1.5",
    "-3",
    "+3",
    " 5",
    "0x10",
    "1e3",
    "1,,2",
    "1,",
    "2147483648",
    "12345678901",
    Array.from({ length: max + 1 }, (_, i) => i + 1).join(","),
  ])("rejects %j", (raw) => {
    expect(parseIdList(raw, { max })).toBeNull();
  });

  it("rejects an overlong list before splitting it", () => {
    const split = vi.spyOn(String.prototype, "split");
    const result = parseIdList("1,".repeat(max * 11), { max });
    const splits = split.mock.calls.length;
    split.mockRestore();
    expect(result).toBeNull();
    expect(splits).toBe(0);
  });

  it("takes the caller's per-id check", () => {
    const even = { max, isValid: (id: number) => id % 2 === 0 };
    expect(parseIdList("2,4", even)).toEqual([2, 4]);
    expect(parseIdList("2,3", even)).toBeNull();
  });
});
