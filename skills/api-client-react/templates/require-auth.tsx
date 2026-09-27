/** Route guard: shows nothing while the session loads, redirects to sign-in when signed out. Written for @tanstack/react-router; useDirectory and the other list/auth hooks work with any router, so swap in your router's Navigate/redirect if you use a different one. */
import { useAuth } from "@softwareseva/auth/react";
import type { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";

export function RequireAuth({ children, role }: { children: ReactNode; role?: string }) {
  const { status, user } = useAuth();
  if (status === "loading") return null;
  if (status === "signed-out") return <Navigate to="/sign-in" search={{ next: `${window.location.pathname}${window.location.search}` }} replace />;
  if (role && !user?.roles.includes(role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
