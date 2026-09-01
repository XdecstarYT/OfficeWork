import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Database } from "../types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function useProfile(userId: string | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLoadedOnceRef = useRef(false);

  // Resolves the *currently* signed-in user via supabase.auth.getUser()
  // rather than trusting the userId this closure was created with - a
  // caller that signs in and immediately creates/joins a company (see
  // GameEntryScreen) may still be holding a pre-login closure bound to
  // userId=null by the time that call resolves and wants to refresh.
  const refresh = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    if (!uid) {
      setProfile(null);
      setLoading(false);
      return;
    }
    // Only flip the full-page "Loading profile…" gate (App.tsx) on for the
    // very first load. Every in-app action that changes money/xp calls this
    // same refresh() afterward - re-triggering that gate on every one of
    // those would remount the whole current tab and silently wipe out
    // whatever local UI state it was showing (an open modal, a just-set
    // status banner).
    if (!hasLoadedOnceRef.current) setLoading(true);
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    setProfile(data ?? null);
    setLoading(false);
    hasLoadedOnceRef.current = true;
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

  return { profile, loading, refresh };
}
