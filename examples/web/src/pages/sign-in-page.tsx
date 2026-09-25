/** Sign-in screen: every provider the API reports as enabled. */
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { SignIn, useAuth } from "@softwareseva/auth/react";

export function SignInPage() {
  const { status } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = params.get("next") ?? "/notes";
  if (status === "signed-in") return <Navigate to={next} replace />;
  return <div className="py-12"><SignIn next={next} onSuccess={() => navigate(next, { replace: true })} /></div>;
}
