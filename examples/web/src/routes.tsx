/** Route tree (TanStack Router, code-based — this app is small enough not to need file-based codegen). */
import { Link, Navigate, Outlet, createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";
import { useAuth } from "@softwareseva/auth/react";
import { Button } from "@softwareseva/ui";
import type { ReactNode } from "react";
import { useSyncLifecycle } from "./hooks/use-sync-lifecycle";
import { NotesPage } from "./pages/notes-page";
import { OfflineNotesPage } from "./pages/offline-notes-page";
import { SignInPage } from "./pages/sign-in-page";

function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") return null;
  if (status === "signed-out") {
    const next = `${window.location.pathname}${window.location.search}`;
    return <Navigate to="/sign-in" search={{ next }} replace />;
  }
  return <>{children}</>;
}

function Shell() {
  const { user, signOut } = useAuth();
  useSyncLifecycle();
  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-4">
          <span className="text-heading">kashi</span>
          {user ? (
            <nav className="flex items-center gap-3 text-body-sm">
              <Link to="/notes" activeProps={{ className: "text-ink font-medium" }} className="text-ink-muted">Notes</Link>
              <Link to="/notes/offline" activeProps={{ className: "text-ink font-medium" }} className="text-ink-muted">Offline notes</Link>
            </nav>
          ) : null}
        </div>
        {user ? <div className="flex items-center gap-3"><span className="text-body-sm text-ink-muted">{user.name}</span><Button variant="ghost" size="sm" onClick={() => void signOut()}>Sign out</Button></div> : null}
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6"><Outlet /></main>
    </div>
  );
}

export const rootRoute = createRootRoute({ component: Shell, notFoundComponent: () => <Navigate to="/notes" replace /> });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => { throw redirect({ to: "/notes" }); },
});

export const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  validateSearch: (search: Record<string, unknown>) => ({ next: typeof search.next === "string" ? search.next : undefined }),
  component: SignInPage,
});

const notesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/notes",
  component: () => <RequireAuth><NotesPage /></RequireAuth>,
});

const offlineNotesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/notes/offline",
  component: () => <RequireAuth><OfflineNotesPage /></RequireAuth>,
});

const routeTree = rootRoute.addChildren([indexRoute, signInRoute, notesRoute, offlineNotesRoute]);
export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
