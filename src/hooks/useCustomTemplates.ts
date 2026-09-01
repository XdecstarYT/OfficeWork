import { useCallback, useEffect, useId, useMemo, useState } from "react";
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
  // Supabase reuses a cached channel object for an identical topic name, so
  // two concurrently-mounted instances of this hook (e.g. CompanyPage and
  // the TemplatePickerModal it renders) sharing one companyId-based topic
  // would have the second instance's .on() calls land on the first
  // instance's already-subscribed channel and throw. A per-mount id keeps
  // every instance's topic unique.
  const instanceId = useId();

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
      .channel(`custom-templates-${companyId}-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "custom_templates", filter: `company_id=eq.${companyId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, instanceId, load]);

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

  /** The delete button should only be offered to whoever built the template
   * or the company owner - RLS enforces the same rule server-side, but the
   * UI should never show a control that's guaranteed to fail. */
  const canRemoveTemplate = useCallback(
    (templateId: string, isOwner: boolean) => {
      const row = rows.find((r) => (r.template as unknown as DocumentTemplate).id === templateId);
      return !!row && (row.created_by === userId || isOwner);
    },
    [rows, userId],
  );

  return { customTemplates, addCustomTemplate, removeCustomTemplate, canRemoveTemplate };
}
