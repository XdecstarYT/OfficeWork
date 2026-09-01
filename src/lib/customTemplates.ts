import { supabase } from "./supabaseClient";
import type { Database } from "../types/database";
import type { DocumentTemplate } from "../types/template";

export type CustomTemplateRow = Database["public"]["Tables"]["custom_templates"]["Row"];

export async function fetchCustomTemplates(companyId: string): Promise<CustomTemplateRow[]> {
  const { data, error } = await supabase
    .from("custom_templates")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function saveCustomTemplate(params: {
  companyId: string;
  createdBy: string;
  template: DocumentTemplate;
}): Promise<CustomTemplateRow> {
  const { companyId, createdBy, template } = params;
  const { data, error } = await supabase
    .from("custom_templates")
    .insert({
      company_id: companyId,
      created_by: createdBy,
      template: template as unknown as Database["public"]["Tables"]["custom_templates"]["Row"]["template"],
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCustomTemplate(id: string) {
  // .select().single() so an RLS-blocked delete (not the creator or the
  // owner) throws instead of silently affecting 0 rows.
  const { error } = await supabase.from("custom_templates").delete().eq("id", id).select().single();
  if (error) throw error;
}
