/** App entry: query client, auth provider, router. */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@kashi/auth/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { api } from "./lib/api";
import { App } from "./app";
import "./index.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: (count, error) => count < 2 && (error as { status?: number }).status !== 401 } } });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider api={api}>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
