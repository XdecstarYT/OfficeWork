import { supabase } from "./supabaseClient";
import type { Database } from "../types/database";

export type MemberMoodRow = Database["public"]["Tables"]["member_moods"]["Row"];

export async function fetchMemberMoods(companyId: string): Promise<MemberMoodRow[]> {
  const { data, error } = await supabase.from("member_moods").select("*").eq("company_id", companyId);
  if (error) throw error;
  return data ?? [];
}

/** One row per member (member_id is the primary key) - upsert so today's
 * pick just overwrites yesterday's rather than growing a history table
 * nobody asked for. */
export async function setMyMood(memberId: string, companyId: string, emoji: string) {
  const { error } = await supabase
    .from("member_moods")
    .upsert({ member_id: memberId, company_id: companyId, emoji, updated_at: new Date().toISOString() });
  if (error) throw error;
}
