/**
 * @file src/mongo/client.ts
 * @desc One MongoClient per process, built on first use (never at import, so builds and pages
 *       without a database need no env). The database is always the one named here, whatever
 *       the URI says. better-auth reads getDb(); Mongoose models live on getModelConnection(),
 *       attached to the same client. The first connect runs the app's onConnect (index builds,
 *       a privilege check, a backfill). State sits on globalThis so dev reloads don't leak
 *       clients; a failed connect is never cached, so one DNS blip can't poison the process.
 *       Moved from packs and pools (src/lib/db.ts), identical apart from the name, the global
 *       key and pools' post-connect work.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { type Db, MongoClient } from "mongodb";
import mongoose, { type Connection } from "mongoose";

/** Two apps share one M0 cluster (500 connections), each over many Vercel instances. */
export const DEFAULT_MAX_POOL_SIZE = 5;

/** Fail fast when the cluster is unreachable: a hung function is billed for every second. */
export const DEFAULT_SERVER_SELECTION_TIMEOUT_MS = 5000;

/** createMongo's options. */
export type MongoOptions = {
  /** The database every call uses, like "packs" or "pools". */
  dbName: string;
  /** The globalThis key the state lives under, like "__poolsMongo"; one per app. */
  globalKey: string;
  /** Reads MONGODB_URI (on first use, not at import). */
  uri: () => string;
  /** Connections per instance (default DEFAULT_MAX_POOL_SIZE). */
  maxPoolSize?: number;
  /** How long to look for a server (default DEFAULT_SERVER_SELECTION_TIMEOUT_MS). */
  serverSelectionTimeoutMS?: number;
  /** Runs once after the first successful connect; a throw fails that connect. */
  onConnect?: (db: Db, client: MongoClient) => Promise<void>;
};

/** What createMongo returns. */
export type Mongo = {
  /** The shared client (connects lazily on first operation). */
  getMongoClient: () => MongoClient;
  /** The database on the shared client. */
  getDb: () => Db;
  /** The Mongoose connection models register on (usable after connectDb). */
  getModelConnection: () => Connection;
  /** Connects once, attaches Mongoose and runs onConnect; retried after a failure. */
  connectDb: () => Promise<void>;
  /** The database once connectDb has resolved. */
  connectedDb: () => Promise<Db>;
  /** Closes the client and forgets it (tests, CLIs). */
  closeDb: () => Promise<void>;
};

type MongoState = {
  client: MongoClient;
  base: Connection;
  models: Connection;
  ready: Promise<void> | null;
};

/**
 * @function createMongo
 * @param options {MongoOptions} the database, the global key, the URI and the start-up work
 * @returns {Mongo} getMongoClient, getDb, getModelConnection, connectDb, connectedDb, closeDb
 */
export const createMongo = ({
  dbName,
  globalKey,
  uri,
  maxPoolSize = DEFAULT_MAX_POOL_SIZE,
  serverSelectionTimeoutMS = DEFAULT_SERVER_SELECTION_TIMEOUT_MS,
  onConnect,
}: MongoOptions): Mongo => {
  const store = globalThis as unknown as Record<string, MongoState | undefined>;

  const createState = (): MongoState => {
    const client = new MongoClient(uri(), { maxPoolSize, serverSelectionTimeoutMS });
    const base = mongoose.createConnection();
    // Connection#useDb, not a React hook. The URI has no path, so pick the database here.
    const models = base.useDb(dbName, { useCache: true });
    return { client, base, models, ready: null };
  };

  const state = (): MongoState => {
    store[globalKey] ??= createState();
    return store[globalKey];
  };

  const getDb = (): Db => state().client.db(dbName);

  const connectDb = async (): Promise<void> => {
    const current = state();
    current.ready ??= current.client.connect().then(async () => {
      if (current.base.readyState === 0) current.base.setClient(current.client);
      await onConnect?.(current.client.db(dbName), current.client);
    });
    try {
      await current.ready;
    } catch (error) {
      current.ready = null;
      throw error;
    }
  };

  return {
    getMongoClient: () => state().client,
    getDb,
    getModelConnection: () => state().models,
    connectDb,
    connectedDb: async () => {
      await connectDb();
      return getDb();
    },
    closeDb: async () => {
      const current = store[globalKey];
      if (!current) return;
      store[globalKey] = undefined;
      await current.client.close();
    },
  };
};
