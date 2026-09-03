import { supabase } from "./supabaseClient";
import type { Database } from "../types/database";

type DocumentEventRow = Database["public"]["Tables"]["document_events"]["Row"];

export interface ActivityItem extends DocumentEventRow {
  documentTitle: string;
}

/**
 * One round trip, joined server-side on the documents FK.
 *
 * This previously fetched every document id in the company and then passed
 * them all back as an `.in(document_id, [...])` filter. That was two round
 * trips, and because PostgREST puts filters in the query string the URL grew
 * by ~40 bytes per document - a company with a few thousand documents would
 * eventually blow past the server's URL length limit and the Activity Feed
 * (and the Dashboard, which shares this call) would fail outright.
 */
export async function fetchCompanyActivity(companyId: string, limit = 100): Promise<ActivityItem[]> {
  const { data, error } = await supabase
    .from("document_events")
    .select("*, documents!inner(title, company_id)")
    .eq("documents.company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows = (data ?? []) as unknown as (DocumentEventRow & {
    documents: { title: string; company_id: string } | null;
  })[];
  return rows.map(({ documents, ...event }) => ({
    ...event,
    documentTitle: documents?.title ?? "a document",
  }));
}
