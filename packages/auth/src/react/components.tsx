/** Ready-made sign-in UI on @softwareseva/ui primitives. Compose these or use <SignIn /> for the default card. */
import { useState } from "react";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, useAppForm } from "@softwareseva/ui";
import { useAuth } from "./context";
import { oauthErrorFromLocation, useOAuthUrl, useOtp, usePasskeySignIn, usePasskeySignUp, usePasswordSignIn } from "./hooks";

const messages: Record<string, string> = {
  INVALID_CREDENTIALS: "That identifier or password is incorrect.",
  INVALID_CODE: "That code is invalid or has expired. Request a new one.",
  RATE_LIMITED: "Too many attempts. Please wait a few minutes.",
  ACCOUNT_DISABLED: "This account is disabled.",
  SIGN_UP_DISABLED: "No account exists for this sign-in.",
  PASSKEY_REJECTED: "The passkey could not be verified.",
  OAUTH_CANCELLED: "Sign-in was cancelled.",
  OAUTH_FAILED: "Sign-in did not complete. Please try again.",
  OAUTH_STATE_INVALID: "Sign-in took too long. Please try again.",
};
export const authMessage = (code: string | null | undefined, fallback = "Something went wrong.") => (code && messages[code]) || fallback;

export function ErrorAlert({ code, message }: { code?: string | null; message?: string }) {
  if (!code && !message) return null;
  return <Alert variant="danger" title={authMessage(code, message)} />;
}

export function PasswordSignIn({ identifierLabel = "Email or phone", onSuccess }: { identifierLabel?: string; onSuccess?: () => void }) {
  const { run, pending, error } = usePasswordSignIn();
  const form = useAppForm({
    defaultValues: { identifier: "", password: "" },
    onSubmit: async ({ value }) => { if (await run(value.identifier, value.password)) onSuccess?.(); },
  });
  return (
    <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); void form.handleSubmit(); }}>
      <ErrorAlert code={error?.code} message={error?.message} />
      <form.AppField name="identifier">{(field) => <field.TextField label={identifierLabel} autoComplete="username" required />}</form.AppField>
      <form.AppField name="password">{(field) => <field.TextField label="Password" type="password" autoComplete="current-password" required />}</form.AppField>
      <Button type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
    </form>
  );
}

export function OtpSignIn({ channel = "phone", onSuccess }: { channel?: "phone" | "email"; onSuccess?: () => void }) {
  const { request, verify } = useOtp();
  const [destination, setDestination] = useState("");
  const [sent, setSent] = useState(false);
  const label = channel === "phone" ? "Phone number" : "Email";
  const sendForm = useAppForm({
    defaultValues: { destination: "" },
    onSubmit: async ({ value }) => { setDestination(value.destination); if (await request.run(value.destination)) setSent(true); },
  });
  const confirmForm = useAppForm({
    defaultValues: { code: "" },
    onSubmit: async ({ value }) => { if (await verify.run(destination, value.code)) onSuccess?.(); },
  });
  if (!sent) return (
    <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); void sendForm.handleSubmit(); }}>
      <ErrorAlert code={request.error?.code} message={request.error?.message} />
      <sendForm.AppField name="destination">
        {(field) => <field.TextField label={label} hint={channel === "phone" ? "We will send a one-time code on WhatsApp or SMS." : "We will email you a one-time code."} type={channel === "phone" ? "tel" : "email"} autoComplete={channel === "phone" ? "tel" : "email"} required />}
      </sendForm.AppField>
      <Button type="submit" disabled={request.pending}>{request.pending ? "Sending…" : "Send code"}</Button>
    </form>
  );
  return (
    <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); void confirmForm.handleSubmit(); }}>
      <ErrorAlert code={verify.error?.code} message={verify.error?.message} />
      <p className="text-body-sm text-muted-foreground">Enter the code sent to {destination}.</p>
      <confirmForm.AppField name="code">
        {(field) => <field.TextField label="Code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{4,8}" required autoFocus />}
      </confirmForm.AppField>
      <Button type="submit" disabled={verify.pending}>{verify.pending ? "Verifying…" : "Verify"}</Button>
      <Button type="button" variant="ghost" onClick={() => { setSent(false); verify.reset(); }}>Use a different {channel === "phone" ? "number" : "email"}</Button>
    </form>
  );
}

export function PasskeyButton({ onSuccess, children = "Sign in with a passkey" }: { onSuccess?: () => void; children?: string }) {
  const { run, pending, error } = usePasskeySignIn();
  return (
    <div className="grid gap-2">
      <ErrorAlert code={error?.code} message={error?.message} />
      <Button type="button" variant="outline" disabled={pending} onClick={async () => { if (await run()) onSuccess?.(); }}>{pending ? "Waiting for your device…" : children}</Button>
    </div>
  );
}

/**
 * The default, anonymous entry point: creates a passkey-only account with no email, phone or
 * OAuth grant. The passkey is verified first; only then does the account get created. Gate any
 * action that needs a reachable identity behind `requireVerified` on the server instead of
 * behind sign-up.
 */
export function PasskeySignUpButton({ onSuccess, children = "Create an account with a passkey" }: { onSuccess?: () => void; children?: string }) {
  const { run, pending, error } = usePasskeySignUp();
  return (
    <div className="grid gap-2">
      <ErrorAlert code={error?.code} message={error?.message} />
      <Button type="button" disabled={pending} onClick={async () => { if (await run()) onSuccess?.(); }}>{pending ? "Waiting for your device…" : children}</Button>
    </div>
  );
}

const oauthLabel: Record<"google" | "apple" | "facebook", string> = { google: "Continue with Google", apple: "Continue with Apple", facebook: "Continue with Facebook" };

export function OAuthButton({ provider, next = "/" }: { provider: "google" | "apple" | "facebook"; next?: string }) {
  const href = useOAuthUrl(provider, next);
  const { api } = useAuth();
  void api;
  return <Button asChild variant="outline"><a href={href}>{oauthLabel[provider]}</a></Button>;
}

/**
 * Default sign-in card: shows every provider the server reports as enabled. Passkeys come first
 * — sign-in for a returning device, sign-up for a new one — since auth is anonymous by default;
 * OTP and OAuth are offered as the way to attach a valid id, not as the primary way in.
 */
export function SignIn({ title = "Sign in", next = "/", onSuccess }: { title?: string; next?: string; onSuccess?: () => void }) {
  const { providers } = useAuth();
  const [mode, setMode] = useState<"otp" | "password">("otp");
  const oauthError = oauthErrorFromLocation();
  if (!providers) return null;
  const showOtp = providers.otp && (mode === "otp" || !providers.password);
  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="grid gap-4">
        {oauthError ? <ErrorAlert code={oauthError} /> : null}
        {providers.passkeys ? <PasskeyButton onSuccess={onSuccess} /> : null}
        {providers.passkeySignUp ? <PasskeySignUpButton onSuccess={onSuccess} /> : null}
        {providers.google ? <OAuthButton provider="google" next={next} /> : null}
        {providers.apple ? <OAuthButton provider="apple" next={next} /> : null}
        {providers.facebook ? <OAuthButton provider="facebook" next={next} /> : null}
        {showOtp ? <OtpSignIn channel={providers.otp!.channel} onSuccess={onSuccess} /> : providers.password ? <PasswordSignIn onSuccess={onSuccess} /> : null}
        {providers.otp && providers.password ? (
          <Button type="button" variant="link" onClick={() => setMode(mode === "otp" ? "password" : "otp")}>{mode === "otp" ? "Use a password instead" : "Use a one-time code instead"}</Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
