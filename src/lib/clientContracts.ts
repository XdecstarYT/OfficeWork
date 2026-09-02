import { supabase } from "./supabaseClient";
import type { Database } from "../types/database";

export type ClientContractRow = Database["public"]["Tables"]["client_contracts"]["Row"];

export async function fetchClientContracts(companyId: string): Promise<ClientContractRow[]> {
  const { data, error } = await supabase
    .from("client_contracts")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createClientContract(params: {
  companyId: string;
  clientId: string;
  title: string;
  totalTasks: number;
  bonusPayout: number;
  createdBy: string;
}): Promise<ClientContractRow> {
  const { data, error } = await supabase
    .from("client_contracts")
    .insert({
      company_id: params.companyId,
      client_id: params.clientId,
      title: params.title,
      total_tasks: params.totalTasks,
      bonus_payout: params.bonusPayout,
      created_by: params.createdBy,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Bumps the active contract (if any) for this client by one completed task.
 * Returns the contract's bonus info once it just finished, so the caller can
 * pay it out - or null if there's no active contract, or it's not done yet. */
export async function incrementContractProgress(
  companyId: string,
  clientId: string,
): Promise<{ title: string; bonusPayout: number } | null> {
  const { data: contract, error } = await supabase
    .from("client_contracts")
    .select("*")
    .eq("company_id", companyId)
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!contract) return null;

  const nextCompleted = contract.completed_tasks + 1;
  const justFinished = nextCompleted >= contract.total_tasks;
  const { error: updateError } = await supabase
    .from("client_contracts")
    .update({ completed_tasks: nextCompleted, status: justFinished ? "completed" : "active" })
    .eq("id", contract.id);
  if (updateError) throw updateError;

  return justFinished ? { title: contract.title, bonusPayout: contract.bonus_payout } : null;
}

/** Renegotiates an existing contract by adding tasks and/or bonus on top of
 * what's already there - used to extend one that's about to (or already
 * did) wrap up, rather than closing it out and starting a fresh one. */
export async function extendContract(contractId: string, addTasks: number, addBonus: number) {
  const { data: contract, error } = await supabase
    .from("client_contracts")
    .select("total_tasks, bonus_payout, completed_tasks")
    .eq("id", contractId)
    .single();
  if (error) throw error;
  const { error: updateError } = await supabase
    .from("client_contracts")
    .update({
      total_tasks: contract.total_tasks + Math.max(0, addTasks),
      bonus_payout: contract.bonus_payout + Math.max(0, addBonus),
      status: "active",
    })
    .eq("id", contractId);
  if (updateError) throw updateError;
}
