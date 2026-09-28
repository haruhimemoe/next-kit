/**
 * @file tests/helpers/db.ts
 * @desc useTestDb(name): a MongoClient on the run's in-memory MongoDB, a database of the file's
 *       own (so files never share rows), every collection dropped before each test, the client
 *       closed after the file.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { type Db, MongoClient } from "mongodb";
import { afterAll, beforeEach, inject } from "vitest";

/**
 * @function useTestDb
 * @param name {string} the file's database name
 * @returns {{ client: MongoClient; db: () => Db; connectedDb: () => Promise<Db> }} the client
 *          and its database (the async form is what counters and limiters take)
 */
export const useTestDb = (name: string) => {
  const client = new MongoClient(inject("mongoUri"));
  const db = () => client.db(name);
  beforeEach(async () => {
    await client.db(name).dropDatabase();
  });
  afterAll(async () => {
    await client.close();
  });
  return { client, db, connectedDb: async () => db() };
};
