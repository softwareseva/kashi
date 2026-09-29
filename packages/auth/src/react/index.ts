/** @softwareseva/auth/react — AuthProvider, hooks and sign-in components. Uses `@softwareseva/core/client` and `@softwareseva/ui`. */
export { AuthProvider, useAuth, type AuthContextValue, type AuthStatus } from "./context";
export { usePasswordSignIn, useOtp, usePasskeySignIn, usePasskeySignUp, usePasskeyRegister, useOAuthUrl, usePeerUrl, oauthErrorFromLocation } from "./hooks";
export { SignIn, PasswordSignIn, OtpSignIn, PasskeyButton, OAuthButton, PeerSignInButton, ErrorAlert, authMessage } from "./components";
export type { AuthUser, SessionResponse, AuthConfigResponse, PasskeyItem, PeerConfig } from "../contracts/index";
