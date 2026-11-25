/**
 * "Sign in with Apple" button for the sign-in screen. Only iOS has it (`AppleSignIn.ios.tsx`);
 * everywhere else this renders nothing and people sign in with the e-mail code.
 */
export interface AppleSignInProps {
  /** Apple's identity token, and the first name Apple shares on the very first sign-in (else null) */
  onCredential: (identityToken: string, givenName: string | null) => void;
  /** Apple's sheet failed (not: the user closed it) */
  onError: () => void;
  disabled?: boolean;
}

export function AppleSignIn(_props: AppleSignInProps) {
  return null;
}
