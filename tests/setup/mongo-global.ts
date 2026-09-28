/**
 * @file tests/setup/mongo-global.ts
 * @desc Vitest global setup: one in-memory MongoDB for the whole run, through the package's own
 *       testing helper, its URI handed to test files as inject("mongoUri").
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

export { startMemoryMongo as default } from "../../src/testing/mongo.js";
