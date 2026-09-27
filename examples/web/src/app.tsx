/** Entry point for the route tree. */
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./routes";

export function App() {
  return <RouterProvider router={router} />;
}
