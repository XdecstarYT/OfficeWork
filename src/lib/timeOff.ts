import { supabase } from "./supabaseClient";
import type { Database } from "../types/database";

export type TimeOffRequestRow = Database["public"]["Tables"]["time_off_requests"]["Row"];

export async function fetchTimeOffRequests(companyId: string): Promise<TimeOffRequestRow[]> {
  const { data, error } = await supabase
    .from("time_off_requests")
    .select("*")
    .eq("company_id", companyId)
    .order("start_date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function requestTimeOff(params: {
  companyId: string;
  memberId: string;
  startDate: string;
  endDate: string;
  reason: string;
}): Promise<TimeOffRequestRow> {
  const { data, error } = await supabase
    .from("time_off_requests")
    .insert({
      company_id: params.companyId,
      member_id: params.memberId,
      start_date: params.startDate,
      end_date: params.endDate,
      reason: params.reason,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function decideTimeOff(id: string, status: "approved" | "denied", decidedBy: string) {
  const { error } = await supabase.from("time_off_requests").update({ status, decided_by: decidedBy }).eq("id", id);
  if (error) throw error;
}

export function isOnLeaveToday(requests: TimeOffRequestRow[], memberId: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return requests.some(
    (r) => r.member_id === memberId && r.status === "approved" && r.start_date <= today && today <= r.end_date,
  );
}
