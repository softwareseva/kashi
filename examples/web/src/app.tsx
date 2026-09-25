/** Routes and layout. */
import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import { useAuth } from "@kashi/auth/react";
import { Button } from "@kashi/ui";
import { NotesPage } from "./pages/notes-page";
import { SignInPage } from "./pages/sign-in-page";

function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return null;
  if (status === "signed-out") return <Navigate to={`/sign-in?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <>{children}</>;
}

function Shell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-heading">kashi</span>
        {user ? <div className="flex items-center gap-3"><span className="text-body-sm text-ink-muted">{user.name}</span><Button variant="ghost" size="sm" onClick={() => void signOut()}>Sign out</Button></div> : null}
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/notes" element={<RequireAuth><NotesPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/notes" replace />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}
