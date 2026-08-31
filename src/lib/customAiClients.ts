import { supabase } from "./supabaseClient";
import type { Database } from "../types/database";
import type { ClientPersona } from "../data/clients";

export type CustomAiClientRow = Database["public"]["Tables"]["custom_ai_clients"]["Row"];

export async function fetchCustomAiClients(companyId: string): Promise<CustomAiClientRow[]> {
  const { data, error } = await supabase
    .from("custom_ai_clients")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createCustomAiClient(params: {
  companyId: string;
  createdBy: string;
  name: string;
  companyName: string;
  avatar: string;
  personality: string;
  categoryAffinity: string[];
  payoutMin: number;
  payoutMax: number;
}): Promise<CustomAiClientRow> {
  const { companyId, createdBy, ...rest } = params;
  const { data, error } = await supabase
    .from("custom_ai_clients")
    .insert({
      company_id: companyId,
      created_by: createdBy,
      name: rest.name,
      company_name: rest.companyName,
      avatar: rest.avatar,
      personality: rest.personality,
      category_affinity: rest.categoryAffinity,
      payout_min: rest.payoutMin,
      payout_max: rest.payoutMax,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCustomAiClient(id: string) {
  const { error } = await supabase.from("custom_ai_clients").delete().eq("id", id);
  if (error) throw error;
}

/** Custom clients are stored as plain rows but the whole AI Clients feature
 * (request generation, negotiation, relationship tracking) speaks the
 * ClientPersona shape - map once here so a custom client behaves exactly
 * like a stock one everywhere else. */
export function customRowToClientPersona(row: CustomAiClientRow): ClientPersona {
  return {
    id: `custom:${row.id}`,
    name: row.name,
    company: row.company_name,
    avatar: row.avatar,
    personality: row.personality,
    categoryAffinity: row.category_affinity,
    payoutRange: [row.payout_min, row.payout_max],
  };
}
