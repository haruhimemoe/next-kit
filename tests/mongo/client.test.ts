/**
 * @file tests/mongo/client.test.ts
 * @desc createMongo against the in-memory MongoDB: packs' cases (tests/integration/lib/db.test.ts:
 *       the database name, one connect for racing callers, one client for better-auth and
 *       Mongoose, a fresh client after closeDb, the 5 s timeout) and pools' (a failed start-up
 *       check isn't cached and runs again on the next connect).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { afterAll, describe, expect, inject, it, vi } from "vitest";
import { createMongo } from "../../src/mongo/index.js";

const onConnect = vi.fn(async () => {});
const mongo = createMongo({
  dbName: "packs",
  globalKey: "__nextKitTestMongo",
  uri: () => inject("mongoUri"),
  onConnect,
});
const { closeDb, connectDb, connectedDb, getDb, getModelConnection, getMongoClient } = mongo;

afterAll(closeDb);

describe("createMongo", () => {
  it("uses the named database, whatever the URI says", async () => {
    await connectDb();
    expect(getDb().databaseName).toBe("packs");
    expect(getModelConnection().name).toBe("packs");
    expect((await connectedDb()).databaseName).toBe("packs");
  });

  it("connects once however many callers race, and runs onConnect once", async () => {
    await closeDb();
    onConnect.mockClear();
    await Promise.all([connectDb(), connectDb(), connectDb()]);
    expect(getModelConnection().readyState).toBe(1);
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onConnect).toHaveBeenCalledWith(getDb(), getMongoClient());
  });

  it("shares one client between better-auth and mongoose", async () => {
    await connectDb();
    expect(getModelConnection().getClient()).toBe(getMongoClient());
  });

  it("keeps its state on globalThis, so a dev reload finds the same client", async () => {
    await connectDb();
    const again = createMongo({ dbName: "packs", globalKey: "__nextKitTestMongo", uri: () => "x" });
    expect(again.getMongoClient()).toBe(getMongoClient());
  });

  it("builds a fresh client after closeDb", async () => {
    await connectDb();
    const before = getMongoClient();
    await closeDb();
    await closeDb();
    await connectDb();
    expect(getMongoClient()).not.toBe(before);
    expect(getModelConnection().readyState).toBe(1);
  });

  it("gives up on an unreachable database after 5 seconds, not 30, with 5 connections", () => {
    expect(getMongoClient().options.serverSelectionTimeoutMS).toBe(5000);
    expect(getMongoClient().options.maxPoolSize).toBe(5);
  });

  it("never caches a failed start-up: the next connect runs it again", async () => {
    await closeDb();
    onConnect.mockClear();
    onConnect.mockRejectedValueOnce(new Error("this user can reach another database"));
    await expect(connectDb()).rejects.toThrow("another database");
    await expect(connectDb()).resolves.toBeUndefined();
    expect(onConnect).toHaveBeenCalledTimes(2);
  });

  it("reads the URI only on first use", () => {
    const uri = vi.fn(() => "mongodb://127.0.0.1:1");
    const lazy = createMongo({
      dbName: "x",
      globalKey: "__nextKitLazy",
      uri,
      maxPoolSize: 2,
      serverSelectionTimeoutMS: 50,
    });
    expect(uri).not.toHaveBeenCalled();
    expect(lazy.getMongoClient().options.maxPoolSize).toBe(2);
    expect(uri).toHaveBeenCalledTimes(1);
    return lazy.closeDb();
  });
});
