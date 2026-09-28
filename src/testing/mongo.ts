/**
 * @file src/testing/mongo.ts
 * @desc Test databases: a Vitest global setup that starts one in-memory MongoDB for the run and
 *       hands its URI to test files (inject("mongoUri")), and setupTestDb, which empties the
 *       given collections before each test and closes the client after the file. Moved from
 *       packs and pools (tests/setup/integration-global.ts, identical, and tests/helpers/db.ts).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import type { Db } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeEach } from "vitest";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    /** The in-memory MongoDB's URI, from startMemoryMongo. */
    mongoUri: string;
  }
}

/** The collections better-auth's MongoDB adapter creates (with its default names). */
export const BETTER_AUTH_COLLECTIONS = Object.freeze([
  "user",
  "session",
  "account",
  "verification",
]);

/**
 * @function startMemoryMongo
 * @param project {TestProject} the Vitest project (a globalSetup's argument)
 * @returns {Promise<() => Promise<void>>} provides "mongoUri"; the returned teardown stops the
 *          server. Use it as a globalSetup's default export.
 */
export const startMemoryMongo = async (project: TestProject): Promise<() => Promise<void>> => {
  const server = await MongoMemoryServer.create();
  project.provide("mongoUri", server.getUri());
  return async () => {
    await server.stop();
  };
};

/** setupTestDb's options: how the app connects, reaches and closes its database. */
export type TestDbOptions = {
  /** Connects (and runs the app's start-up work, like index builds). */
  connect: () => Promise<unknown>;
  /** The connected database. */
  db: () => Db;
  /** Closes and forgets the client. */
  close: () => Promise<unknown>;
  /** Every collection a test may write to; emptied before each test. */
  collections: readonly string[];
};

/**
 * @function setupTestDb
 * @param options {TestDbOptions} connect, db, close and the collections to empty
 * @returns {void} registers beforeEach (connect, then empty) and afterAll (close) hooks
 */
export const setupTestDb = ({ connect, db, close, collections }: TestDbOptions): void => {
  beforeEach(async () => {
    await connect();
    await Promise.all(collections.map((name) => db().collection(name).deleteMany({})));
  });
  afterAll(async () => {
    await close();
  });
};
