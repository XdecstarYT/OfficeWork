import { supabase } from "./supabaseClient";
import type { Database } from "../types/database";

export type EmailRow = Database["public"]["Tables"]["emails"]["Row"];

export async function fetchInbox(userId: string): Promise<EmailRow[]> {
  const { data, error } = await supabase
    .from("emails")
    .select("*")
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function sendEmailToCoworker(params: {
  companyId: string;
  senderId: string;
  recipientId: string;
  subject: string;
  body: string;
}) {
  const { error } = await supabase.from("emails").insert({
    company_id: params.companyId,
    sender_id: params.senderId,
    recipient_id: params.recipientId,
    subject: params.subject,
    body: params.body,
  });
  if (error) throw error;
}

export async function sendEmailToClient(params: {
  companyId: string;
  senderId: string;
  clientId: string;
  subject: string;
  body: string;
}) {
  const { error } = await supabase.from("emails").insert({
    company_id: params.companyId,
    sender_id: params.senderId,
    recipient_client_id: params.clientId,
    subject: params.subject,
    body: params.body,
  });
  if (error) throw error;
}

export async function recordClientReply(params: {
  companyId: string;
  recipientId: string;
  clientId: string;
  subject: string;
  body: string;
}) {
  const { error } = await supabase.from("emails").insert({
    company_id: params.companyId,
    sender_client_id: params.clientId,
    recipient_id: params.recipientId,
    subject: params.subject,
    body: params.body,
  });
  if (error) throw error;
}

export async function sendEmailToNpc(params: {
  companyId: string;
  senderId: string;
  npcId: string;
  subject: string;
  body: string;
}) {
  const { error } = await supabase.from("emails").insert({
    company_id: params.companyId,
    sender_id: params.senderId,
    recipient_npc_id: params.npcId,
    subject: params.subject,
    body: params.body,
  });
  if (error) throw error;
}

export async function recordNpcReply(params: {
  companyId: string;
  recipientId: string;
  npcId: string;
  subject: string;
  body: string;
}) {
  const { error } = await supabase.from("emails").insert({
    company_id: params.companyId,
    sender_npc_id: params.npcId,
    recipient_id: params.recipientId,
    subject: params.subject,
    body: params.body,
  });
  if (error) throw error;
}

export async function markRead(emailId: string) {
  const { error } = await supabase
    .from("emails")
    .update({ read_at: new Date().toISOString() })
    .eq("id", emailId);
  if (error) throw error;
}
