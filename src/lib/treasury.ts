import { supabase } from "./supabaseClient";
import type { Database } from "../types/database";

export type TreasuryTransactionRow = Database["public"]["Tables"]["treasury_transactions"]["Row"];

export async function fetchTreasuryLedger(companyId: string, limit = 50): Promise<TreasuryTransactionRow[]> {
  const { data, error } = await supabase
    .from("treasury_transactions")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Everything this member has ever put into the treasury, for the endgame
 * ladder. Filtered and summed rather than paged, since only the total is
 * ever shown. */
export async function fetchMyContributionTotal(companyId: string, memberId: string): Promise<number> {
  const { data, error } = await supabase
    .from("treasury_transactions")
    .select("amount")
    .eq("company_id", companyId)
    .eq("member_id", memberId)
    .gt("amount", 0);
  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + row.amount, 0);
}

/** The company's cut of one payout, after the borrower's own perk discount. */
export function treasuryCutFor(payout: number, cutPercent: number, discountPercent = 0): number {
  const effective = (cutPercent / 100) * (1 - discountPercent / 100);
  return Math.max(0, Math.round(payout * effective * 100) / 100);
}

/**
 * Adds to the company treasury. Goes through a SECURITY DEFINER RPC because
 * only a company's owner may UPDATE `companies`, but every member's completed
 * work funds the treasury; the function bounds the amount and writes the
 * ledger row in the same statement so balance and ledger can't disagree.
 */
export async function contributeToTreasury(amount: number, reason: string): Promise<number | null> {
  if (amount <= 0) return null;
  const { data, error } = await supabase.rpc("contribute_to_treasury", {
    p_amount: amount,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

/** Owner-only: moves money out of the treasury and records why. */
export async function spendTreasury(params: {
  companyId: string;
  currentTreasury: number;
  amount: number;
  reason: string;
  memberId?: string | null;
}): Promise<number> {
  const { companyId, currentTreasury, amount, reason, memberId } = params;
  if (amount <= 0) throw new Error("Enter an amount above zero.");
  if (amount > currentTreasury) throw new Error("The treasury doesn't have that much.");

  const remaining = currentTreasury - amount;
  const { error } = await supabase.from("companies").update({ treasury: remaining }).eq("id", companyId);
  if (error) throw error;

  const { error: ledgerError } = await supabase
    .from("treasury_transactions")
    .insert({ company_id: companyId, amount: -amount, reason, member_id: memberId ?? null });
  if (ledgerError) throw ledgerError;
  return remaining;
}

export async function setTreasuryCut(companyId: string, percent: number) {
  const clamped = Math.max(0, Math.min(50, Math.round(percent)));
  const { error } = await supabase.from("companies").update({ treasury_cut_percent: clamped }).eq("id", companyId);
  if (error) throw error;
  return clamped;
}
