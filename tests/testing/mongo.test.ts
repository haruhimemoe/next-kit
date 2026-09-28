/**
 * @file tests/testing/mongo.test.ts
 * @desc setupTestDb empties the listed collections before each test; startMemoryMongo provides a
 *       working URI and stops its server; the env stubs put the fake osu! app env in process.env.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { type Db, MongoClient } from "mongodb";
import { afterAll, describe, expect, inject, it, vi } from "vitest";
import type { TestProject } from "vitest/node";
import {
  BETTER_AUTH_COLLECTIONS,
  setupTestDb,
  startMemoryMongo,
  stubEnv,
  stubOsuAppEnv,
  TEST_OSU_APP_ENV,
} from "../../src/testing/index.js";

let client: MongoClient | null = null;
const db = (): Db => {
  if (!client) throw new Error("not connected");
  return client.db("testing");
};

setupTestDb({
  connect: async () => {
    client ??= await new MongoClient(inject("mongoUri")).connect();
  },
  db,
  close: async () => {
    await client?.close();
    client = null;
  },
  collections: ["things", ...BETTER_AUTH_COLLECTIONS],
});

describe("setupTestDb", () => {
  it("lets a test write", async () => {
    await db().collection("things").insertOne({ n: 1 });
    await db().collection("user").insertOne({ n: 1 });
    expect(await db().collection("things").countDocuments()).toBe(1);
  });

  it("empties every listed collection before the next test", async () => {
    expect(await db().collection("things").countDocuments()).toBe(0);
    expect(await db().collection("user").countDocuments()).toBe(0);
    expect(Object.isFrozen(BETTER_AUTH_COLLECTIONS)).toBe(true);
  });
});

describe("startMemoryMongo", () => {
  it("provides a URI that connects, and stops the server on teardown", async () => {
    const provide = vi.fn();
    const stop = await startMemoryMongo({ provide } as unknown as TestProject);
    const [key, uri] = provide.mock.calls[0] as [string, string];
    expect(key).toBe("mongoUri");
    const other = await new MongoClient(uri).connect();
    expect((await other.db("x").command({ ping: 1 })).ok).toBe(1);
    await other.close();
    await stop();
  });
});

describe("stubEnv and stubOsuAppEnv", () => {
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("puts the fake env, with overrides, in process.env", () => {
    stubOsuAppEnv({ MONGODB_URI: "mongodb://db.test:27017" });
    expect(process.env.BETTER_AUTH_SECRET).toBe(TEST_OSU_APP_ENV.BETTER_AUTH_SECRET);
    expect(process.env.MONGODB_URI).toBe("mongodb://db.test:27017");
    stubEnv({ EXTRA: "1" });
    expect(process.env.EXTRA).toBe("1");
    stubOsuAppEnv();
    expect(process.env.MONGODB_URI).toBe(TEST_OSU_APP_ENV.MONGODB_URI);
  });
});
