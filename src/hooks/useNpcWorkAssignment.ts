import { useCallback, useEffect, useId, useState } from "react";
import { fetchCompanyNpcs, resolveNpcPersona, type CompanyNpcRow } from "../lib/npcs";
import { fetchCustomNpcPersonas, type CustomNpcPersonaRow } from "../lib/customNpcPersonas";
import { assignWorkToNpc, completeNpcWork } from "../lib/documents";
import { draftDocumentFields } from "../lib/aiClient";
import { supabase } from "../lib/supabaseClient";
import type { LlmConfig } from "../lib/llmConfig";
import type { Database } from "../types/database";
import type { DocumentTemplate } from "../types/template";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/** Shared by every page that can hand a template to a hired AI coworker
 * instead of a human (CompanyPage, Filing Cabinet) - keeps the roster fetch
 * and the assign-draft-complete sequence in one place instead of
 * duplicated per page. */
export function useNpcWorkAssignment(profile: Profile, llmConfig: LlmConfig) {
  const [npcs, setNpcs] = useState<CompanyNpcRow[]>([]);
  const [customNpcPersonas, setCustomNpcPersonas] = useState<CustomNpcPersonaRow[]>([]);
  const [assigningNpc, setAssigningNpc] = useState<CompanyNpcRow | null>(null);
  const [npcWorking, setNpcWorking] = useState(false);
  const instanceId = useId();

  const reloadNpcs = useCallback(async () => {
    if (!profile.company_id) {
      setNpcs([]);
      setCustomNpcPersonas([]);
      return;
    }
    const [n, cp] = await Promise.all([
      fetchCompanyNpcs(profile.company_id),
      fetchCustomNpcPersonas(profile.company_id),
    ]);
    setNpcs(n);
    setCustomNpcPersonas(cp);
  }, [profile.company_id]);

  useEffect(() => {
    reloadNpcs();
  }, [reloadNpcs]);

  useEffect(() => {
    if (!profile.company_id) return;
    const channel = supabase
      .channel(`npc-work-${profile.company_id}-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "company_npcs", filter: `company_id=eq.${profile.company_id}` },
        () => reloadNpcs(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "custom_npc_personas",
          filter: `company_id=eq.${profile.company_id}`,
        },
        () => reloadNpcs(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.company_id, instanceId, reloadNpcs]);

  /** Assigns `template` to `npc` (defaults to whichever NPC was set via
   * setAssigningNpc, for callers that pick the coworker first and the
   * template second via a modal's onPick), drafts it with the AI, and
   * completes it - returns a status message to show the caller's own
   * banner/toast (never throws). Takes the NPC as an explicit parameter
   * rather than only reading it from state so a caller that picks the
   * template first and the coworker second (e.g. the Filing Cabinet) can
   * fire immediately in the same event handler, without waiting a render
   * cycle for setAssigningNpc to land in this hook's closure. */
  const assignTemplateToNpc = useCallback(
    async (template: DocumentTemplate, npc?: CompanyNpcRow): Promise<string> => {
      const targetNpc = npc ?? assigningNpc;
      if (!profile.company_id || !targetNpc) return "";
      const persona = resolveNpcPersona(targetNpc, customNpcPersonas);
      if (!persona) {
        setAssigningNpc(null);
        return "That coworker's persona is missing - pick another one.";
      }
      setNpcWorking(true);
      try {
        const doc = await assignWorkToNpc({
          companyId: profile.company_id,
          template,
          createdBy: profile.id,
          npcId: targetNpc.id,
        });
        // The document row already exists at this point (status
        // "in_progress") - if drafting fails, still complete it with blank
        // fields instead of leaving a permanently orphaned row.
        try {
          const values = await draftDocumentFields({
            title: `${template.title} (drafted by ${persona.name}, ${persona.suggestedTitle})`,
            fields: template.fields,
            filledValues: {},
            config: llmConfig,
          });
          await completeNpcWork(doc.id, profile.id, values);
          return `${persona.name} finished "${template.title}" — check the Archive to review it.`;
        } catch {
          await completeNpcWork(doc.id, profile.id, {});
          return `${persona.name} couldn't reach the AI to draft "${template.title}" — it's in the Archive blank, needs a manual fill-in.`;
        }
      } catch (err) {
        return err instanceof Error ? err.message : "Couldn't get that work done.";
      } finally {
        setNpcWorking(false);
        setAssigningNpc(null);
      }
    },
    [profile.company_id, profile.id, assigningNpc, customNpcPersonas, llmConfig],
  );

  return {
    npcs,
    customNpcPersonas,
    assigningNpc,
    setAssigningNpc,
    npcWorking,
    assignTemplateToNpc,
    reloadNpcs,
  };
}
