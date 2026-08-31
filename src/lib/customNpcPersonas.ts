import { supabase } from "./supabaseClient";
import type { Database } from "../types/database";
import type { NpcPersona } from "../data/npcs";

export type CustomNpcPersonaRow = Database["public"]["Tables"]["custom_npc_personas"]["Row"];

export async function fetchCustomNpcPersonas(companyId: string): Promise<CustomNpcPersonaRow[]> {
  const { data, error } = await supabase
    .from("custom_npc_personas")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createCustomNpcPersona(params: {
  companyId: string;
  createdBy: string;
  name: string;
  avatar: string;
  personality: string;
  jobTitle: string;
  level: number;
  hireCost: number;
}): Promise<CustomNpcPersonaRow> {
  const { companyId, createdBy, ...rest } = params;
  const { data, error } = await supabase
    .from("custom_npc_personas")
    .insert({
      company_id: companyId,
      created_by: createdBy,
      name: rest.name,
      avatar: rest.avatar,
      personality: rest.personality,
      job_title: rest.jobTitle,
      level: rest.level,
      hire_cost: rest.hireCost,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCustomNpcPersona(id: string) {
  const { error } = await supabase.from("custom_npc_personas").delete().eq("id", id);
  if (error) throw error;
}

/** Custom personas are stored as plain rows, not NpcPersona objects, so every
 * place that emails/drafts/displays an NPC (which all speak the NpcPersona
 * shape) needs this to treat a custom hire exactly like a stock one. */
export function customPersonaToNpcPersona(row: CustomNpcPersonaRow): NpcPersona {
  return {
    key: `custom:${row.id}`,
    name: row.name,
    avatar: row.avatar,
    suggestedTitle: row.job_title,
    suggestedLevel: row.level,
    personality: row.personality,
    hireCost: row.hire_cost,
  };
}
