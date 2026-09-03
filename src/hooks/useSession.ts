import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

/** Anything in the boot path that can hang (a stalled token refresh, a
 * network that accepts the connection but never answers) gets this long
 * before we give up and show a retry instead of an eternal spinner. */
const BOOT_TIMEOUT_MS = 12_000;

export function withTimeout<T>(promise: PromiseLike<T>, ms = BOOT_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out - the server didn't answer.")), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { data } = await withTimeout(supabase.auth.getSession());
      setSession(data.session);
    } catch (err) {
      // Without this catch a rejected getSession() (expired refresh token on
      // a flaky connection) would leave loading=true forever, and App.tsx
      // would sit on "Loading…" with no way out.
      setSession(null);
      setError(err instanceof Error ? err.message : "Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setError(null);
      setLoading(false);
    });

    return () => subscription.subscription.unsubscribe();
  }, [refresh]);

  return { session, user: session?.user ?? null, loading, error, refresh };
}
