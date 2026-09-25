/** Entry: query client, auth provider, app. */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@softwareseva/auth/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { api } from "./lib/api";
import "./index.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: (n, e) => n < 2 && (e as { status?: number }).status !== 401 } } });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider api={api}>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
