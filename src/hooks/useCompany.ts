import { useCallback, useEffect, useRef, useState } from "react";
import { fetchCompany } from "../lib/company";
import { supabase } from "../lib/supabaseClient";
import type { Database } from "../types/database";

type Company = Database["public"]["Tables"]["companies"]["Row"];

export function useCompany(companyId: string | null) {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const loadedCompanyIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setCompany(null);
      setLoading(false);
      return;
    }
    // Only gate the whole app behind "Loading game…" (App.tsx) for a
    // company we haven't loaded before - this refresh() also re-runs on
    // every realtime change to the companies row (rename, salary, badges,
    // day advance, ...), and re-flipping loading=true each time would
    // remount the active tab and wipe its local UI state.
    if (loadedCompanyIdRef.current !== companyId) setLoading(true);
    const data = await fetchCompany(companyId);
    setCompany(data);
    setLoading(false);
    loadedCompanyIdRef.current = companyId;
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

  return { company, loading, refresh };
}
