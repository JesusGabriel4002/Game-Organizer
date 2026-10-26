import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { keys } from "./queries";
import { hydrateSecureSession, isSupabaseConfigured } from "./supabase";
import { getSyncState, nextBackoffMs, refreshPending, subscribeSync, syncNow, type SyncState } from "./sync";

const DEBOUNCE_MS = 3_000;
const INTERVAL_MS = 60_000;
const OUTBOX_POLL_MS = 2_000;

/** Keeps the local SQLite outbox in sync with Supabase while the user is signed in. */
export function useCloudSync() {
  const qc = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPending = useRef(0);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    let cancelled = false;

    const run = async () => {
      try {
        const { pulled } = await syncNow();
        if (!cancelled && pulled > 0) {
          await Promise.all([keys.library, keys.categories, keys.goals].map((k) => qc.invalidateQueries({ queryKey: k })));
        }
      } catch {
        const wait = nextBackoffMs();
        if (wait) timer.current = setTimeout(() => void run(), wait);
      }
    };

    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void run(), DEBOUNCE_MS);
    };

    void (async () => {
      await hydrateSecureSession();
      await refreshPending();
      if (!cancelled) await run();
    })();

    const onOnline = () => void run();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", () => void refreshPending());

    interval.current = setInterval(() => void run(), INTERVAL_MS);

    const pollOutbox = setInterval(() => {
      void refreshPending().then(() => {
        const { pending, status } = getSyncState();
        if (pending > lastPending.current && status !== "syncing" && navigator.onLine) schedule();
        lastPending.current = pending;
      });
    }, OUTBOX_POLL_MS);

    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      if (timer.current) clearTimeout(timer.current);
      if (interval.current) clearInterval(interval.current);
      clearInterval(pollOutbox);
    };
  }, [qc]);
}

export function useSyncStatus(): SyncState {
  const [state, setState] = useState(getSyncState);
  useEffect(() => {
    const unsub = subscribeSync(setState);
    return () => {
      unsub();
    };
  }, []);
  return state;
}
