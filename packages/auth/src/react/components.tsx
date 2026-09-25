/** Ready-made sign-in UI on @kashi/ui primitives. Compose these or use <SignIn /> for the default card. */
import { useState, type FormEvent } from "react";
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Field, Input } from "@kashi/ui";
import { useAuth } from "./context";
import { oauthErrorFromLocation, useOAuthUrl, useOtp, usePasskeySignIn, usePasswordSignIn } from "./hooks";

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
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (await run(String(form.get("identifier")), String(form.get("password")))) onSuccess?.();
  }
  return (
    <form className="grid gap-4" onSubmit={submit}>
      <ErrorAlert code={error?.code} message={error?.message} />
      <Field id="identifier" label={identifierLabel}><Input name="identifier" autoComplete="username" required /></Field>
      <Field id="password" label="Password"><Input name="password" type="password" autoComplete="current-password" required /></Field>
      <Button type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
    </form>
  );
}

export function OtpSignIn({ channel = "phone", onSuccess }: { channel?: "phone" | "email"; onSuccess?: () => void }) {
  const { request, verify } = useOtp();
  const [destination, setDestination] = useState("");
  const [sent, setSent] = useState(false);
  const label = channel === "phone" ? "Phone number" : "Email";
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (await request.run(destination)) setSent(true);
  }
  async function confirm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code"));
    if (await verify.run(destination, code)) onSuccess?.();
  }
  if (!sent) return (
    <form className="grid gap-4" onSubmit={send}>
      <ErrorAlert code={request.error?.code} message={request.error?.message} />
      <Field id="destination" label={label} hint={channel === "phone" ? "We will send a one-time code on WhatsApp or SMS." : "We will email you a one-time code."}>
        <Input name="destination" type={channel === "phone" ? "tel" : "email"} autoComplete={channel === "phone" ? "tel" : "email"} value={destination} onChange={(e) => setDestination(e.target.value)} required />
      </Field>
      <Button type="submit" disabled={request.pending}>{request.pending ? "Sending…" : "Send code"}</Button>
    </form>
  );
  return (
    <form className="grid gap-4" onSubmit={confirm}>
      <ErrorAlert code={verify.error?.code} message={verify.error?.message} />
      <p className="text-body-sm text-muted-foreground">Enter the code sent to {destination}.</p>
      <Field id="code" label="Code"><Input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{4,8}" required autoFocus /></Field>
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

export function OAuthButton({ provider, next = "/" }: { provider: "google" | "apple"; next?: string }) {
  const href = useOAuthUrl(provider, next);
  const { api } = useAuth();
  void api;
  return <Button asChild variant="outline"><a href={href}>{provider === "google" ? "Continue with Google" : "Continue with Apple"}</a></Button>;
}

/** Default sign-in card: shows every provider the server reports as enabled. */
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
        {providers.google ? <OAuthButton provider="google" next={next} /> : null}
        {providers.apple ? <OAuthButton provider="apple" next={next} /> : null}
        {showOtp ? <OtpSignIn channel={providers.otp!.channel} onSuccess={onSuccess} /> : providers.password ? <PasswordSignIn onSuccess={onSuccess} /> : null}
        {providers.otp && providers.password ? (
          <Button type="button" variant="link" onClick={() => setMode(mode === "otp" ? "password" : "otp")}>{mode === "otp" ? "Use a password instead" : "Use a one-time code instead"}</Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
