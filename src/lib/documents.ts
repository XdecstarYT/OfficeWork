import { supabase } from "./supabaseClient";
import type { Database, DocumentStatus } from "../types/database";
import type { DocumentTemplate, Difficulty } from "../types/template";

export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
export interface ReferenceRow {
  label: string;
  value: string;
}

export function referenceDataFor(doc: Pick<DocumentRow, "reference_data">): ReferenceRow[] {
  return Array.isArray(doc.reference_data) ? (doc.reference_data as unknown as ReferenceRow[]) : [];
}

const PAYOUT_BY_DIFFICULTY: Record<Difficulty, number> = {
  quick: 10,
  standard: 20,
  detailed: 35,
};

export function estimatePayout(template: DocumentTemplate | { difficulty: Difficulty }): number {
  return PAYOUT_BY_DIFFICULTY[template.difficulty];
}

/** A manager-set payout wins over the flat per-difficulty default. `bonusPercent`
 * (from purchased Office Shop equipment) is applied on top of either. */
export function payoutFor(
  doc: Pick<DocumentRow, "payout_override">,
  template: DocumentTemplate,
  bonusPercent = 0,
): number {
  const base = doc.payout_override ?? estimatePayout(template);
  return base * (1 + bonusPercent / 100);
}

/** Payout for a stats row, which carries `difficulty` lifted out of the
 * snapshot instead of the whole template. Same maths as payoutFor. */
export function payoutForStat(row: DocumentStatRow, bonusPercent = 0): number {
  const base = row.payout_override ?? (row.difficulty ? PAYOUT_BY_DIFFICULTY[row.difficulty] : 0);
  return base * (1 + bonusPercent / 100);
}

const XP_BY_DIFFICULTY: Record<Difficulty, number> = {
  quick: 10,
  standard: 25,
  detailed: 50,
};

/** Career XP awarded on completion - a separate track from Money, so harder
 * work (not just higher-paying work) is what actually moves it. */
export function estimateXp(template: DocumentTemplate | { difficulty: Difficulty }): number {
  return XP_BY_DIFFICULTY[template.difficulty];
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
  initialFieldValues?: Record<string, string>;
  dueInDays?: number;
  payoutOverride?: number;
  referenceData?: ReferenceRow[];
  /** Manager opted in to sign-off even though the template has no signature field. */
  forceApproval?: boolean;
}): Promise<DocumentRow> {
  const {
    companyId,
    template,
    createdBy,
    assignedTo,
    isSelfRequest,
    initialFieldValues,
    dueInDays,
    payoutOverride,
    referenceData,
    forceApproval,
  } = params;
  const status: DocumentStatus = isSelfRequest ? "requested" : "assigned";
  // Self-requested work has no natural approver (nobody necessarily outranks
  // you), so only boss-assigned work carries the sign-off requirement -
  // otherwise a solo owner could self-assign a signature-required template
  // and have it stuck in pending_approval forever with nobody able to clear it.
  const requiresApproval = !isSelfRequest && (templateRequiresApproval(template) || !!forceApproval);
  const due_at = dueInDays
    ? new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000).toISOString()
    : undefined;

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
      ...(initialFieldValues ? { field_values: initialFieldValues } : {}),
      ...(due_at ? { due_at } : {}),
      ...(payoutOverride != null ? { payout_override: payoutOverride } : {}),
      ...(referenceData && referenceData.length > 0
        ? { reference_data: referenceData as unknown as Database["public"]["Tables"]["documents"]["Row"]["reference_data"] }
        : {}),
    })
    .select()
    .single();
  if (error) throw error;

  await logEvent(data.id, createdBy, isSelfRequest ? "requested" : "assigned");
  return data;
}

/** Hands a template to a hired AI coworker instead of a human. The document
 * is created already "in_progress" (an NPC never sits in someone's queue),
 * and the caller is expected to immediately fill it in via
 * completeNpcWork() once the AI has drafted the fields. No payout is set -
 * NPCs are salaried by their one-time hire cost, not per task, so this
 * can't be used to farm Money the way an infinitely-repeatable paid task
 * could. */
export async function assignWorkToNpc(params: {
  companyId: string;
  template: DocumentTemplate;
  createdBy: string;
  npcId: string;
  referenceData?: ReferenceRow[];
}): Promise<DocumentRow> {
  const { companyId, template, createdBy, npcId, referenceData } = params;
  const { data, error } = await supabase
    .from("documents")
    .insert({
      company_id: companyId,
      template_id: template.id,
      template_snapshot: template as unknown as Database["public"]["Tables"]["documents"]["Row"]["template_snapshot"],
      title: template.title,
      status: "in_progress",
      requires_approval: false,
      created_by: createdBy,
      assigned_to_npc_id: npcId,
      payout_override: 0,
      ...(referenceData && referenceData.length > 0
        ? { reference_data: referenceData as unknown as Database["public"]["Tables"]["documents"]["Row"]["reference_data"] }
        : {}),
    })
    .select()
    .single();
  if (error) throw error;

  await logEvent(data.id, createdBy, "assigned", "Assigned to AI coworker");
  return data;
}

export async function completeNpcWork(
  documentId: string,
  actorId: string,
  fieldValues: Record<string, string>,
) {
  const { error } = await supabase
    .from("documents")
    .update({
      field_values: fieldValues,
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", documentId);
  if (error) throw error;
  await logEvent(documentId, actorId, "completed", "Completed by AI coworker");
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

/** Every column a counting/stats surface needs, and none of the heavy ones.
 *
 * `template_snapshot` is an entire template object (fields, body text)
 * stored per document row, and `field_values`/`reference_data` hold whatever
 * was typed into it. Selecting `*` meant the notification poller, Dashboard,
 * Leaderboard, Company page, Calendar and Filing Cabinet each downloaded all
 * of that for every document in the company just to count things - hundreds
 * of KB per load, re-fetched on every realtime document change. Only
 * `difficulty` is actually needed from the snapshot (for payout/XP maths),
 * so it's lifted out server-side with a JSON accessor. */
export interface DocumentStatRow {
  id: string;
  company_id: string;
  title: string;
  status: DocumentStatus;
  template_id: string | null;
  created_by: string;
  assigned_to: string | null;
  assigned_to_npc_id: string | null;
  payout_override: number | null;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  difficulty: Difficulty | null;
}

const STAT_COLUMNS =
  "id,company_id,title,status,template_id,created_by,assigned_to,assigned_to_npc_id,payout_override,due_at,completed_at,created_at,updated_at,difficulty:template_snapshot->>difficulty";

export async function fetchCompanyDocumentStats(companyId: string): Promise<DocumentStatRow[]> {
  const { data, error } = await supabase
    .from("documents")
    .select(STAT_COLUMNS)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as DocumentStatRow[];
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
