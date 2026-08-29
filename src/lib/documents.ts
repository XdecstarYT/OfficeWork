import { supabase } from "./supabaseClient";
import type { Database, DocumentStatus } from "../types/database";
import type { DocumentTemplate, Difficulty } from "../types/template";

export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];

const PAYOUT_BY_DIFFICULTY: Record<Difficulty, number> = {
  quick: 10,
  standard: 20,
  detailed: 35,
};

export function estimatePayout(template: DocumentTemplate | { difficulty: Difficulty }): number {
  return PAYOUT_BY_DIFFICULTY[template.difficulty];
}

export function templateRequiresApproval(template: DocumentTemplate): boolean {
  return template.fields.some((f) => f.type === "signature");
}

async function logEvent(documentId: string, actorId: string, eventType: string, note?: string) {
  await supabase.from("document_events").insert({
    document_id: documentId,
    actor_id: actorId,
    event_type: eventType,
    note,
  });
}

export async function assignWork(params: {
  companyId: string;
  template: DocumentTemplate;
  createdBy: string;
  assignedTo: string;
  isSelfRequest: boolean;
}): Promise<DocumentRow> {
  const { companyId, template, createdBy, assignedTo, isSelfRequest } = params;
  const status: DocumentStatus = isSelfRequest ? "requested" : "assigned";
  // Self-requested work has no natural approver (nobody necessarily outranks
  // you), so only boss-assigned work carries the sign-off requirement -
  // otherwise a solo owner could self-assign a signature-required template
  // and have it stuck in pending_approval forever with nobody able to clear it.
  const requiresApproval = !isSelfRequest && templateRequiresApproval(template);

  const { data, error } = await supabase
    .from("documents")
    .insert({
      company_id: companyId,
      template_id: template.id,
      template_snapshot: template as unknown as Database["public"]["Tables"]["documents"]["Row"]["template_snapshot"],
      title: template.title,
      status,
      requires_approval: requiresApproval,
      created_by: createdBy,
      assigned_to: assignedTo,
    })
    .select()
    .single();
  if (error) throw error;

  await logEvent(data.id, createdBy, isSelfRequest ? "requested" : "assigned");
  return data;
}

export async function fetchMyDocuments(userId: string): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchCompanyDocuments(companyId: string): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function submitDocument(
  documentId: string,
  actorId: string,
  fieldValues: Record<string, string>,
  requiresApproval: boolean,
): Promise<DocumentStatus> {
  const nextStatus: DocumentStatus = requiresApproval ? "pending_approval" : "completed";
  const { error } = await supabase
    .from("documents")
    .update({
      field_values: fieldValues,
      status: nextStatus,
      ...(nextStatus === "completed" ? { completed_at: new Date().toISOString() } : {}),
    })
    .eq("id", documentId);
  if (error) throw error;
  await logEvent(documentId, actorId, nextStatus === "completed" ? "completed" : "submitted");
  return nextStatus;
}

export async function approveDocument(documentId: string, approverId: string) {
  const { error } = await supabase
    .from("documents")
    .update({
      status: "completed",
      approver_id: approverId,
      completed_at: new Date().toISOString(),
      approval_note: null,
    })
    .eq("id", documentId);
  if (error) throw error;
  await logEvent(documentId, approverId, "approved");
}

export async function rejectDocument(documentId: string, approverId: string, note: string) {
  const { error } = await supabase
    .from("documents")
    .update({ status: "assigned", approver_id: approverId, approval_note: note })
    .eq("id", documentId);
  if (error) throw error;
  await logEvent(documentId, approverId, "rejected", note);
}

export async function sendToPerson(
  documentId: string,
  actorId: string,
  newAssigneeId: string,
  note?: string,
) {
  const { error } = await supabase
    .from("documents")
    .update({ assigned_to: newAssigneeId, status: "assigned" })
    .eq("id", documentId);
  if (error) throw error;
  await logEvent(documentId, actorId, "sent", note);
}
