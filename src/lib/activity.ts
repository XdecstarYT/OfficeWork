import { supabase } from "./supabaseClient";
import type { Database } from "../types/database";

type DocumentEventRow = Database["public"]["Tables"]["document_events"]["Row"];

export interface ActivityItem extends DocumentEventRow {
  documentTitle: string;
}

export async function fetchCompanyActivity(companyId: string, limit = 100): Promise<ActivityItem[]> {
  const { data: docs, error: docsError } = await supabase
    .from("documents")
    .select("id, title")
    .eq("company_id", companyId);
  if (docsError) throw docsError;

  const docIds = (docs ?? []).map((d) => d.id);
  if (docIds.length === 0) return [];
  const titleById = new Map((docs ?? []).map((d) => [d.id, d.title] as const));

  const { data: events, error } = await supabase
    .from("document_events")
    .select("*")
    .in("document_id", docIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (events ?? []).map((e) => ({
    ...e,
    documentTitle: titleById.get(e.document_id) ?? "a document",
  }));
}
