import { supabase } from "./supabaseClient";
import type { Database } from "../types/database";

export type BoardMeetingRow = Database["public"]["Tables"]["board_meetings"]["Row"];
export type RsvpRow = Database["public"]["Tables"]["board_meeting_rsvps"]["Row"];
export type RsvpStatus = RsvpRow["status"];

export async function fetchMeetings(companyId: string): Promise<BoardMeetingRow[]> {
  const { data, error } = await supabase
    .from("board_meetings")
    .select("*")
    .eq("company_id", companyId)
    .order("scheduled_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchRsvpsForMeetings(meetingIds: string[]): Promise<RsvpRow[]> {
  if (meetingIds.length === 0) return [];
  const { data, error } = await supabase
    .from("board_meeting_rsvps")
    .select("*")
    .in("meeting_id", meetingIds);
  if (error) throw error;
  return data ?? [];
}

export async function scheduleMeeting(params: {
  companyId: string;
  title: string;
  agenda: string;
  scheduledAt: string;
  createdBy: string;
  memberIds: string[];
}): Promise<BoardMeetingRow> {
  const { companyId, title, agenda, scheduledAt, createdBy, memberIds } = params;
  const { data: meeting, error } = await supabase
    .from("board_meetings")
    .insert({
      company_id: companyId,
      title,
      agenda: agenda || null,
      scheduled_at: scheduledAt,
      created_by: createdBy,
    })
    .select()
    .single();
  if (error) throw error;

  const rsvpRows = memberIds.map((userId) => ({
    meeting_id: meeting.id,
    user_id: userId,
    status: userId === createdBy ? ("attending" as const) : ("invited" as const),
    responded_at: userId === createdBy ? new Date().toISOString() : null,
  }));
  const { error: rsvpError } = await supabase.from("board_meeting_rsvps").insert(rsvpRows);
  if (rsvpError) throw rsvpError;

  return meeting;
}

export async function setRsvp(meetingId: string, userId: string, status: RsvpStatus) {
  const { error } = await supabase
    .from("board_meeting_rsvps")
    .update({ status, responded_at: new Date().toISOString() })
    .eq("meeting_id", meetingId)
    .eq("user_id", userId);
  if (error) throw error;
}
