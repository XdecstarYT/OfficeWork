import { supabase } from "./supabaseClient";
import type { Database } from "../types/database";
import type { NpcPersona } from "../data/npcs";

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
}): Promise<CompanyNpcRow> {
  const { companyId, hiredBy, persona } = params;
  const { data, error } = await supabase
    .from("company_npcs")
    .insert({
      company_id: companyId,
      persona_key: persona.key,
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
  const { error } = await supabase.from("company_npcs").delete().eq("id", id);
  if (error) throw error;
}
