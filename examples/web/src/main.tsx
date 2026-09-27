/** Entry: query client, auth provider, app. */
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@softwareseva/core/react";
import { AuthProvider } from "@softwareseva/auth/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { api } from "./lib/api";
import "./index.css";

const queryClient = createQueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider api={api}>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
