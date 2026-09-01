import { supabase } from "./supabaseClient";
import type { Database } from "../types/database";

export type CompanyDepartmentRow = Database["public"]["Tables"]["company_departments"]["Row"];

export async function fetchCompanyDepartments(companyId: string): Promise<CompanyDepartmentRow[]> {
  const { data, error } = await supabase
    .from("company_departments")
    .select("*")
    .eq("company_id", companyId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addCompanyDepartment(
  companyId: string,
  createdBy: string,
  name: string,
): Promise<CompanyDepartmentRow> {
  const { data, error } = await supabase
    .from("company_departments")
    .insert({ company_id: companyId, created_by: createdBy, name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeCompanyDepartment(id: string) {
  const { error } = await supabase.from("company_departments").delete().eq("id", id).select().single();
  if (error) throw error;
}
