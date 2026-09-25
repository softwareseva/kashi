/** Route guard: shows nothing while the session loads, redirects to sign-in when signed out. */
import { useAuth } from "@kashi/auth/react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

export function RequireAuth({ children, role }: { children: ReactNode; role?: string }) {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === "loading") return null;
  if (status === "signed-out") return <Navigate to={`/sign-in?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (role && !user?.roles.includes(role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
