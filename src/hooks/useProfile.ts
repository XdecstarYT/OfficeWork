import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { withTimeout } from "./useSession";
import type { Database } from "../types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function useProfile(userId: string | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);

  // Resolves the *currently* signed-in user rather than trusting the userId
  // this closure was created with - a caller that signs in and immediately
  // creates/joins a company (see GameEntryScreen) may still be holding a
  // pre-login closure bound to userId=null by the time that call resolves.
  //
  // getSession() rather than getUser(): both report the current user, but
  // getSession() reads the locally-stored session while getUser() makes a
  // network call to /auth/v1/user. This runs before *every* profile refresh -
  // and every completed document, bonus, and trade triggers one - so that was
  // an extra round trip on the critical path of every action in the game.
  const refresh = useCallback(async () => {
    setError(null);
    try {
      const { data: sessionData } = await withTimeout(supabase.auth.getSession());
      const uid = sessionData.session?.user?.id ?? null;
      if (!uid) {
        setProfile(null);
        setLoading(false);
        hasLoadedOnceRef.current = true;
        return;
      }
      // Only flip the full-page "Loading profile…" gate (App.tsx) on for the
      // very first load. Every in-app action that changes money/xp calls this
      // same refresh() afterward - re-triggering that gate on every one of
      // those would remount the whole current tab and silently wipe out
      // whatever local UI state it was showing (an open modal, a just-set
      // status banner).
      if (!hasLoadedOnceRef.current) setLoading(true);
      const { data, error: queryError } = await withTimeout(
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      );
      // Previously this error was discarded and the profile set to null,
      // which left App.tsx rendering "Loading profile…" forever with no
      // retry and no explanation.
      if (queryError) throw queryError;
      setProfile(data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your profile.");
    } finally {
      setLoading(false);
      hasLoadedOnceRef.current = true;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [userId, refresh]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`profile-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  return { profile, loading, error, refresh };
}
