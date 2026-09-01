import { supabase } from "./supabaseClient";
import type { Database } from "../types/database";

export type CompanyEquipmentRow = Database["public"]["Tables"]["company_equipment"]["Row"];

export async function fetchCompanyEquipment(companyId: string): Promise<CompanyEquipmentRow[]> {
  const { data, error } = await supabase.from("company_equipment").select("*").eq("company_id", companyId);
  if (error) throw error;
  return data ?? [];
}

export async function purchaseEquipment(
  companyId: string,
  itemKey: string,
  purchasedBy: string,
): Promise<CompanyEquipmentRow> {
  const { data, error } = await supabase
    .from("company_equipment")
    .insert({ company_id: companyId, item_key: itemKey, purchased_by: purchasedBy })
    .select()
    .single();
  if (error) throw error;
  return data;
}
