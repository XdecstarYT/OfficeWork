import { supabase } from "./supabaseClient";
import type { Database } from "../types/database";

export type CorporateUpdateRow = Database["public"]["Tables"]["corporate_updates"]["Row"];

export async function fetchCorporateUpdates(companyId: string): Promise<CorporateUpdateRow[]> {
  const { data, error } = await supabase
    .from("corporate_updates")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function postCorporateUpdate(params: {
  companyId: string;
  title: string;
  body: string;
  postedBy: string;
  category?: CorporateUpdateRow["category"];
}): Promise<CorporateUpdateRow> {
  const { companyId, title, body, postedBy, category } = params;
  const { data, error } = await supabase
    .from("corporate_updates")
    .insert({
      company_id: companyId,
      title,
      body,
      posted_by: postedBy,
      ...(category ? { category } : {}),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCorporateUpdate(id: string) {
  const { error } = await supabase.from("corporate_updates").delete().eq("id", id).select().single();
  if (error) throw error;
}

export async function setCorporateUpdatePinned(id: string, pinned: boolean) {
  const { error } = await supabase.from("corporate_updates").update({ pinned }).eq("id", id);
  if (error) throw error;
}
