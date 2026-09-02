import { supabase } from "./supabaseClient";
import { awardMoney } from "./company";
import type { Database } from "../types/database";

export type StockHoldingRow = Database["public"]["Tables"]["stock_holdings"]["Row"];
export type StockTransactionRow = Database["public"]["Tables"]["stock_transactions"]["Row"];

export async function fetchHoldings(memberId: string): Promise<StockHoldingRow[]> {
  const { data, error } = await supabase.from("stock_holdings").select("*").eq("member_id", memberId);
  if (error) throw error;
  return data ?? [];
}

/** Company-wide recent trades (a lightweight "trading floor" feed) plus the
 * caller's own trades from any company they've since left. */
export async function fetchRecentTransactions(companyId: string, limit = 30): Promise<StockTransactionRow[]> {
  const { data, error } = await supabase
    .from("stock_transactions")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyTransactions(memberId: string, limit = 50): Promise<StockTransactionRow[]> {
  const { data, error } = await supabase
    .from("stock_transactions")
    .select("*")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Buys `shares` of `symbol` at `price`, deducting the cost from the
 * caller's money and rolling the purchase into their existing position's
 * weighted-average cost (or opening a new one). Not run as a single atomic
 * transaction server-side - same read-then-write pattern the rest of this
 * app's money/rank mutations use, acceptable here since a player can't
 * double-click their way into two trades landing at once in practice. */
export async function buyStock(params: {
  memberId: string;
  companyId: string | null;
  symbol: string;
  shares: number;
  price: number;
  currentMoney: number;
}) {
  const { memberId, companyId, symbol, shares, price, currentMoney } = params;
  const cost = shares * price;
  if (cost > currentMoney) throw new Error("Not enough money for that trade.");

  const { data: existing, error: fetchError } = await supabase
    .from("stock_holdings")
    .select("*")
    .eq("member_id", memberId)
    .eq("symbol", symbol)
    .maybeSingle();
  if (fetchError) throw fetchError;

  if (existing) {
    const totalShares = existing.shares + shares;
    const totalCost = existing.shares * existing.avg_cost + cost;
    const { error } = await supabase
      .from("stock_holdings")
      .update({ shares: totalShares, avg_cost: totalCost / totalShares, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("stock_holdings")
      .insert({ member_id: memberId, symbol, shares, avg_cost: price });
    if (error) throw error;
  }

  await awardMoney(memberId, -cost);
  const { error: txError } = await supabase
    .from("stock_transactions")
    .insert({ company_id: companyId, member_id: memberId, symbol, side: "buy", shares, price });
  if (txError) throw txError;
}

/** Sells `shares` of `symbol` at `price`, crediting the proceeds and
 * shrinking (or closing out) the holding. avg_cost is left as-is on a
 * partial sale, so the remaining position's cost basis is unaffected. */
export async function sellStock(params: {
  memberId: string;
  companyId: string | null;
  symbol: string;
  shares: number;
  price: number;
}) {
  const { memberId, companyId, symbol, shares, price } = params;

  const { data: existing, error: fetchError } = await supabase
    .from("stock_holdings")
    .select("*")
    .eq("member_id", memberId)
    .eq("symbol", symbol)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!existing || existing.shares < shares) throw new Error("You don't own that many shares.");

  const remaining = existing.shares - shares;
  if (remaining <= 0) {
    const { error } = await supabase.from("stock_holdings").delete().eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("stock_holdings")
      .update({ shares: remaining, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw error;
  }

  const proceeds = shares * price;
  await awardMoney(memberId, proceeds);
  const { error: txError } = await supabase
    .from("stock_transactions")
    .insert({ company_id: companyId, member_id: memberId, symbol, side: "sell", shares, price });
  if (txError) throw txError;
}
