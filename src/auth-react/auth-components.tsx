/**
 * @file src/auth-react/auth-components.tsx
 * @desc createAuthComponents: SignInWithOsu, SignOutButton, AccountMenu and DeleteAccountForm
 *       with the app's better-auth client and account kit already bound, so what's left is plain
 *       data a server page can pass. Export them from the app's own "use client" module, next to
 *       createAccount's.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import type { ReactNode } from "react";
import { AccountMenu, type AccountMenuProps } from "./AccountMenu.js";
import type { Account } from "./account-store.js";
import { DeleteAccountForm, type DeleteAccountFormProps } from "./DeleteAccountForm.js";
import { SignInWithOsu, type SignInWithOsuProps, type StartSignIn } from "./SignInWithOsu.js";
import { SignOutButton, type SignOutButtonProps } from "./SignOutButton.js";

/** The part of a better-auth client the components call. */
export type AuthUiClient = {
  signIn: { social: StartSignIn };
  signOut: () => Promise<unknown>;
};

/** The part of createAccount's kit the components use. */
export type AuthUiAccount = { useAccount: () => Account; markSignedOut: () => void };

/** The bound components' props: each component's own, minus what's bound. */
export type BoundSignInProps = Omit<SignInWithOsuProps, "signIn">;
/** SignOutButton's props minus the bound sign-out. */
export type BoundSignOutProps = Omit<SignOutButtonProps, "signOut" | "onSignedOut">;
/** AccountMenu's props minus the bound account and sign-out. */
export type BoundAccountMenuProps = Omit<AccountMenuProps, "account" | "signOut" | "onSignedOut">;
/** DeleteAccountForm's props minus the bound onDeleted. */
export type BoundDeleteAccountProps = Omit<DeleteAccountFormProps, "onDeleted">;

/** What createAuthComponents returns. */
export type AuthComponents = {
  SignInWithOsu: (props: BoundSignInProps) => ReactNode;
  SignOutButton: (props: BoundSignOutProps) => ReactNode;
  AccountMenu: (props: BoundAccountMenuProps) => ReactNode;
  DeleteAccountForm: (props: BoundDeleteAccountProps) => ReactNode;
};

/**
 * @function createAuthComponents
 * @param client {AuthUiClient} the app's better-auth client (signIn.social and signOut)
 * @param account {AuthUiAccount} createAccount's kit (useAccount and markSignedOut)
 * @returns {AuthComponents} the four components with the client and account bound
 */
export const createAuthComponents = (
  client: AuthUiClient,
  account: AuthUiAccount,
): AuthComponents => {
  const signIn: StartSignIn = (body) => client.signIn.social(body);
  const signOut = () => client.signOut();
  const onSignedOut = () => account.markSignedOut();
  return {
    SignInWithOsu: (props) => <SignInWithOsu {...props} signIn={signIn} />,
    SignOutButton: (props) => (
      <SignOutButton {...props} signOut={signOut} onSignedOut={onSignedOut} />
    ),
    AccountMenu: function BoundAccountMenu(props) {
      const current = account.useAccount();
      return (
        <AccountMenu {...props} account={current} signOut={signOut} onSignedOut={onSignedOut} />
      );
    },
    DeleteAccountForm: (props) => <DeleteAccountForm {...props} onDeleted={onSignedOut} />,
  };
};
