/** Start the offline sync engine on sign-in; wipe local data on sign-out, before another user signs in on this device. */
import { useEffect, useRef } from "react";
import { useAuth } from "@softwareseva/auth/react";
import { offlineSyncEngine } from "../lib/offline-sync";

export function useSyncLifecycle(): void {
  const { status } = useAuth();
  const started = useRef(false);
  useEffect(() => {
    if (status === "signed-in" && !started.current) {
      started.current = true;
      offlineSyncEngine.start();
    } else if (status === "signed-out" && started.current) {
      started.current = false;
      void offlineSyncEngine.clearAll();
    }
  }, [status]);
}
