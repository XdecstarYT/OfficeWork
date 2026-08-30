import { useCallback, useEffect, useState } from "react";
import { fetchCompany } from "../lib/company";
import { supabase } from "../lib/supabaseClient";
import type { Database } from "../types/database";

type Company = Database["public"]["Tables"]["companies"]["Row"];

export function useCompany(companyId: string | null) {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!companyId) {
      setCompany(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await fetchCompany(companyId);
    setCompany(data);
    setLoading(false);
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
