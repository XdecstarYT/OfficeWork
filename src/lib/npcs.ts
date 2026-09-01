import { supabase } from "./supabaseClient";
import type { Database } from "../types/database";
import { getNpcPersona, type NpcPersona } from "../data/npcs";
import { customPersonaToNpcPersona, type CustomNpcPersonaRow } from "./customNpcPersonas";

export type CompanyNpcRow = Database["public"]["Tables"]["company_npcs"]["Row"];

export async function fetchCompanyNpcs(companyId: string): Promise<CompanyNpcRow[]> {
  const { data, error } = await supabase
    .from("company_npcs")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function hireNpc(params: {
  companyId: string;
  hiredBy: string;
  persona: NpcPersona;
  customPersonaId?: string;
}): Promise<CompanyNpcRow> {
  const { companyId, hiredBy, persona, customPersonaId } = params;
  const { data, error } = await supabase
    .from("company_npcs")
    .insert({
      company_id: companyId,
      persona_key: customPersonaId ? null : persona.key,
      custom_persona_id: customPersonaId ?? null,
      job_title: persona.suggestedTitle,
      level: persona.suggestedLevel,
      hired_by: hiredBy,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fireNpc(id: string) {
  // .select().single() so an RLS-blocked delete (not the hirer or the
  // owner) throws instead of silently affecting 0 rows.
  const { error } = await supabase.from("company_npcs").delete().eq("id", id).select().single();
  if (error) throw error;
}

/** A hired NPC references either a stock persona_key or a company-shared
 * custom_persona_id - resolve either back to the common NpcPersona shape
 * that email/draft/display code already speaks. */
export function resolveNpcPersona(
  npc: CompanyNpcRow,
  customPersonas: CustomNpcPersonaRow[],
): NpcPersona | undefined {
  if (npc.persona_key) return getNpcPersona(npc.persona_key);
  const custom = customPersonas.find((p) => p.id === npc.custom_persona_id);
  return custom ? customPersonaToNpcPersona(custom) : undefined;
}
