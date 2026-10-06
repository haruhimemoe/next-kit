/**
 * @file src/auth-react/index.ts
 * @desc @haruhimemoe/next-kit/auth-react: the browser side of osu! sign-in. The signed-in marker
 *       cookie, the account store and useAccount, RestoreSignedIn, what the sign-in button
 *       sends, where to go after sign-in, and the account components (sign in, sign out, the
 *       header's account menu, delete my account), styled with @haruhimemoe/ui. No "use client" here: the hook and component
 *       files carry it, so a server page can still call safeNextPath from this entry point.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

export { OSU_PROVIDER_ID } from "../auth/osu-id.js";
export {
  DEFAULT_SIGN_IN_PATH,
  type SafeNextOptions,
  safeNextPath,
  signInHref,
} from "../server/safe-next.js";
export {
  AccountMenu,
  type AccountMenuProps,
} from "./AccountMenu.js";
export {
  type Account,
  type AccountDeps,
  type AccountStore,
  createAccountStore,
  LOADING,
  type SessionData,
} from "./account-store.js";
export {
  type AuthComponents,
  type AuthUiAccount,
  type AuthUiClient,
  type BoundAccountMenuProps,
  type BoundDeleteAccountProps,
  type BoundSignInProps,
  type BoundSignOutProps,
  createAuthComponents,
} from "./auth-components.js";
export { OSU_AVATAR_HOSTS, osuAvatarSrc } from "./avatar.js";
export { DeleteAccountForm, type DeleteAccountFormProps } from "./DeleteAccountForm.js";
export {
  createSignedInMarker,
  markerMaxAge,
  SHARED_MARKER_COOKIE,
  type SignedInMarker,
} from "./marker.js";
export { RestoreSignedIn, type RestoreSignedInProps } from "./RestoreSignedIn.js";
export {
  SignInWithOsu,
  type SignInWithOsuProps,
  type StartSignIn,
  signInErrorMessage,
} from "./SignInWithOsu.js";
export { SignOutButton, type SignOutButtonProps } from "./SignOutButton.js";
export { type OsuSignIn, osuSignIn } from "./sign-in.js";
export {
  type AccountKit,
  type BoundRestoreProps,
  createAccount,
  type SessionClient,
  sessionFetcher,
  useAccount,
} from "./use-account.js";
