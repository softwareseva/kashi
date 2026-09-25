/** @kashi/auth/react — AuthProvider, hooks and sign-in components. Uses `@kashi/core/client` and `@kashi/ui`. */
export { AuthProvider, useAuth, type AuthContextValue, type AuthStatus } from "./context";
export { usePasswordSignIn, useOtp, usePasskeySignIn, usePasskeyRegister, useOAuthUrl, oauthErrorFromLocation } from "./hooks";
export { SignIn, PasswordSignIn, OtpSignIn, PasskeyButton, OAuthButton, ErrorAlert, authMessage } from "./components";
export type { AuthUser, SessionResponse, AuthConfigResponse, PasskeyItem } from "../contracts/index";
