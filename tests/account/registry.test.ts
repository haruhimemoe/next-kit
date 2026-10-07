/**
 * @file tests/account/registry.test.ts
 * @desc secretFor (unset and short secrets count as unset) and appUrl (https only, http only on
 *       localhost, a broken base URL refused).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { describe, expect, it } from "vitest";
import { appUrl, secretFor } from "../../src/account/registry.js";

const app = (baseUrl: string) => ({ id: "packs", name: "packs", baseUrl, secretEnv: "S" });

describe("secretFor", () => {
  it("reads the app's env var when it's at least 32 bytes", () => {
    expect(secretFor(app("https://a.test"), { S: "x".repeat(32) })).toBe("x".repeat(32));
    expect(secretFor(app("https://a.test"), { S: "x".repeat(31) })).toBeUndefined();
    expect(secretFor(app("https://a.test"), {})).toBeUndefined();
  });
});

describe("appUrl", () => {
  it("joins the path onto an https origin", () => {
    expect(appUrl(app("https://packs.haruhime.moe/ignored"), "/api/x")?.href).toBe(
      "https://packs.haruhime.moe/api/x",
    );
  });

  it("allows http only on localhost", () => {
    expect(appUrl(app("http://localhost:3001"), "/a")?.href).toBe("http://localhost:3001/a");
    expect(appUrl(app("http://packs.haruhime.moe"), "/a")).toBeNull();
    expect(appUrl(app("ftp://packs.haruhime.moe"), "/a")).toBeNull();
    expect(appUrl(app("not a url"), "/a")).toBeNull();
  });
});
