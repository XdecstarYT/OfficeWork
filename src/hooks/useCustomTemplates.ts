import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchCustomTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
  type CustomTemplateRow,
} from "../lib/customTemplates";
import { supabase } from "../lib/supabaseClient";
import type { DocumentTemplate } from "../types/template";

/** Custom templates are shared company-wide (Supabase-backed) so a task
 * one member builds is immediately usable by the whole team, not just
 * visible in the browser that built it. */
export function useCustomTemplates(companyId: string | null, userId: string | null) {
  const [rows, setRows] = useState<CustomTemplateRow[]>([]);

  const load = useCallback(async () => {
    if (!companyId) {
      setRows([]);
      return;
    }
    setRows(await fetchCustomTemplates(companyId));
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`custom-templates-${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "custom_templates", filter: `company_id=eq.${companyId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, load]);

  const customTemplates = useMemo(
    () => rows.map((r) => r.template as unknown as DocumentTemplate),
    [rows],
  );

  const addCustomTemplate = useCallback(
    async (template: DocumentTemplate) => {
      if (!companyId || !userId) return;
      await saveCustomTemplate({ companyId, createdBy: userId, template });
      // Don't rely solely on realtime to pick this up - refresh directly so
      // the builder's own save always shows up immediately.
      await load();
    },
    [companyId, userId, load],
  );

  const removeCustomTemplate = useCallback(
    async (templateId: string) => {
      const row = rows.find((r) => (r.template as unknown as DocumentTemplate).id === templateId);
      if (row) {
        await deleteCustomTemplate(row.id);
        await load();
      }
    },
    [rows, load],
  );

  return { customTemplates, addCustomTemplate, removeCustomTemplate };
}
