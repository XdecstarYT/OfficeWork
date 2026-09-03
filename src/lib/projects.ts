import { supabase } from "./supabaseClient";
import { awardMoney } from "./company";
import { spendTreasury } from "./treasury";
import type { DocumentStatRow } from "./documents";
import type { Database } from "../types/database";

export type ProjectRow = Database["public"]["Tables"]["company_projects"]["Row"];

export interface ProjectProgress {
  project: ProjectRow;
  /** Completed documents tagged to this project. */
  done: number;
  /** Everything tagged to it, done or not. */
  tagged: number;
  percent: number;
  /** Completed count per member, for splitting the bonus pool. */
  contributors: { memberId: string; done: number }[];
  ready: boolean;
}

export async function fetchProjects(companyId: string): Promise<ProjectRow[]> {
  const { data, error } = await supabase
    .from("company_projects")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Progress is derived from the documents themselves rather than a counter
 * column, so it can never drift from what the Archive actually shows. */
export function projectProgress(project: ProjectRow, docs: DocumentStatRow[]): ProjectProgress {
  const tagged = docs.filter((d) => d.project_id === project.id);
  const completed = tagged.filter((d) => d.status === "completed");
  const counts = new Map<string, number>();
  for (const d of completed) {
    if (d.assigned_to) counts.set(d.assigned_to, (counts.get(d.assigned_to) ?? 0) + 1);
  }
  return {
    project,
    done: completed.length,
    tagged: tagged.length,
    percent: Math.min(100, Math.round((completed.length / project.target_documents) * 100)),
    contributors: [...counts.entries()]
      .map(([memberId, done]) => ({ memberId, done }))
      .sort((a, b) => b.done - a.done),
    ready: completed.length >= project.target_documents && project.status === "active",
  };
}

export async function createProject(params: {
  companyId: string;
  name: string;
  description: string | null;
  emoji: string;
  targetDocuments: number;
  bonusPool: number;
  dueDay: number | null;
  createdBy: string;
  currentTreasury: number;
}): Promise<ProjectRow> {
  const { companyId, bonusPool, currentTreasury, ...rest } = params;
  if (bonusPool > currentTreasury) {
    throw new Error("The treasury can't cover that bonus pool.");
  }

  const { data, error } = await supabase
    .from("company_projects")
    .insert({
      company_id: companyId,
      name: rest.name,
      description: rest.description,
      emoji: rest.emoji,
      target_documents: rest.targetDocuments,
      bonus_pool: bonusPool,
      due_day: rest.dueDay,
      created_by: rest.createdBy,
    })
    .select()
    .single();
  if (error) throw error;

  // The pool is ring-fenced the moment the project opens, so the owner can't
  // promise the same money to two projects.
  if (bonusPool > 0) {
    await spendTreasury({
      companyId,
      currentTreasury,
      amount: bonusPool,
      reason: `Funded project "${rest.name}"`,
      memberId: rest.createdBy,
    });
  }
  return data;
}

/**
 * Closes a finished project and splits its ring-fenced pool between whoever
 * completed its documents, in proportion to how many each did. The money
 * already left the treasury when the project was funded.
 */
export async function completeProject(progress: ProjectProgress): Promise<{ memberId: string; amount: number }[]> {
  const { project, contributors } = progress;
  if (project.status !== "active") throw new Error("That project is already closed.");

  const totalDone = contributors.reduce((sum, c) => sum + c.done, 0);
  const payouts =
    totalDone > 0 && project.bonus_pool > 0
      ? contributors.map((c) => ({
          memberId: c.memberId,
          amount: Math.round((project.bonus_pool * c.done * 100) / totalDone) / 100,
        }))
      : [];

  const { error } = await supabase
    .from("company_projects")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", project.id);
  if (error) throw error;

  for (const payout of payouts) {
    if (payout.amount > 0) await awardMoney(payout.memberId, payout.amount);
  }
  return payouts;
}

/** Cancelling returns the ring-fenced pool to the treasury. */
export async function cancelProject(project: ProjectRow, currentTreasury: number): Promise<void> {
  const { error } = await supabase
    .from("company_projects")
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .eq("id", project.id);
  if (error) throw error;

  if (project.bonus_pool > 0) {
    const { error: refundError } = await supabase
      .from("companies")
      .update({ treasury: currentTreasury + project.bonus_pool })
      .eq("id", project.company_id);
    if (refundError) throw refundError;
    const { error: ledgerError } = await supabase.from("treasury_transactions").insert({
      company_id: project.company_id,
      amount: project.bonus_pool,
      reason: `Refunded cancelled project "${project.name}"`,
    });
    if (ledgerError) throw ledgerError;
  }
}

/** Tags an existing document into a project (or clears it). */
export async function setDocumentProject(documentId: string, projectId: string | null) {
  const { error } = await supabase.from("documents").update({ project_id: projectId }).eq("id", documentId);
  if (error) throw error;
}
