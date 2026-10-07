/**
 * @file src/account/index.ts
 * @desc @haruhimemoe/next-kit/account: account export and delete fan-out from the hub to every
 *       satellite app (the hub's fanOut and exportBundle, each app's createAccountHandlers) and
 *       the static app registry it shares with the inbox. Server only.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

export {
  DELETE_RETRY_DELAYS_MS,
  type ExportBundle,
  exportBundle,
  FAN_OUT_TIMEOUT_MS,
  type FanOutOptions,
  type FanOutReport,
  type FanOutResult,
  fanOut,
} from "./fan-out.js";
export {
  type AccountHandlers,
  type AccountHandlersOptions,
  createAccountHandlers,
} from "./handlers.js";
export {
  ACCOUNT_PATH,
  type AccountApp,
  type AccountOp,
  appUrl,
  MIN_ACCOUNT_SECRET_BYTES,
  secretFor,
  USER_ID_PATTERN,
  usableSecret,
} from "./registry.js";
