import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { withTimeout } from "./useSession";
import type { Database } from "../types/database";

type Company = Database["public"]["Tables"]["companies"]["Row"];

export function useCompany(companyId: string | null) {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedCompanyIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setCompany(null);
      setLoading(false);
      return;
    }
    setError(null);
    // Only gate the whole app behind "Loading game…" (App.tsx) for a
    // company we haven't loaded before - this refresh() also re-runs on
    // every realtime change to the companies row (rename, salary, badges,
    // day advance, ...), and re-flipping loading=true each time would
    // remount the active tab and wipe its local UI state.
    if (loadedCompanyIdRef.current !== companyId) setLoading(true);
    try {
      // The error was previously discarded here too: a failed read (or a
      // company_id pointing at a row RLS won't return) set company=null,
      // and App.tsx then sat on "Loading game…" indefinitely.
      const { data, error: queryError } = await withTimeout(
        supabase.from("companies").select("*").eq("id", companyId).maybeSingle(),
      );
      if (queryError) throw queryError;
      setCompany(data ?? null);
      loadedCompanyIdRef.current = companyId;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your company.");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`company-${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "companies", filter: `id=eq.${companyId}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, refresh]);

  return { company, loading, error, refresh };
}
