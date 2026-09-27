/** Sign-in screen: every provider the API reports as enabled. */
import { getRouteApi, Navigate } from "@tanstack/react-router";
import { SignIn, useAuth } from "@softwareseva/auth/react";

const route = getRouteApi("/sign-in");

export function SignInPage() {
  const { status } = useAuth();
  const { next = "/notes" } = route.useSearch();
  const navigate = route.useNavigate();
  // `next` is an arbitrary redirect target read from the URL, not a route the tree can type-check.
  if (status === "signed-in") return <Navigate to={next as never} replace />;
  return <div className="py-12"><SignIn next={next} onSuccess={() => navigate({ to: next as never, replace: true })} /></div>;
}
