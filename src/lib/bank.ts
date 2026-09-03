import { supabase } from "./supabaseClient";
import { awardMoney } from "./company";
import type { Database } from "../types/database";

export type LoanRow = Database["public"]["Tables"]["company_loans"]["Row"];

/** Interest compounds once per in-game day, charged when the day is ended. */
const GRACE_DAYS = 3;
/** Overdue loans compound at double rate - the reason to repay on time. */
const OVERDUE_MULTIPLIER = 2;

export interface LoanOffer {
  id: string;
  label: string;
  emoji: string;
  principal: number;
  /** Compounded per in-game day, as a fraction (0.02 = 2%/day). */
  dailyRate: number;
  termDays: number;
  /** Minimum credit score this desk will lend at. */
  minScore: number;
}

export const LOAN_OFFERS: LoanOffer[] = [
  { id: "petty", label: "Petty Cash Advance", emoji: "🪙", principal: 150, dailyRate: 0.02, termDays: 5, minScore: 0 },
  { id: "working", label: "Working Capital Line", emoji: "💼", principal: 500, dailyRate: 0.025, termDays: 10, minScore: 40 },
  { id: "expansion", label: "Expansion Loan", emoji: "🏗", principal: 1500, dailyRate: 0.03, termDays: 20, minScore: 60 },
  { id: "leveraged", label: "Leveraged Buyout Facility", emoji: "🏦", principal: 5000, dailyRate: 0.035, termDays: 30, minScore: 80 },
];

export interface CreditRating {
  score: number;
  grade: string;
  blurb: string;
}

/**
 * Credit score out of 100, derived entirely from the loan book so there is
 * nothing extra to keep in sync: clean repayments build it up, defaults and
 * carrying a lot of debt drag it down. Everyone starts at 50 - enough for the
 * two smaller desks, not enough for the big ones.
 */
export function creditRating(loans: LoanRow[], perkScoreBonus = 0): CreditRating {
  const repaid = loans.filter((l) => l.status === "repaid").length;
  const defaulted = loans.filter((l) => l.status === "defaulted").length;
  const active = loans.filter((l) => l.status === "active");
  const outstanding = active.reduce((sum, l) => sum + l.balance, 0);

  let score = 50 + repaid * 12 - defaulted * 25 - Math.floor(outstanding / 250) * 4 + perkScoreBonus;
  score = Math.max(0, Math.min(100, score));

  const grade =
    score >= 90 ? "AAA" : score >= 78 ? "AA" : score >= 66 ? "A" : score >= 52 ? "BBB" : score >= 38 ? "BB" : score >= 22 ? "B" : "CCC";
  const blurb =
    score >= 78
      ? "Blue chip. Every desk will take your call."
      : score >= 52
        ? "Solid. Most facilities are open to you."
        : score >= 22
          ? "Watchlist. Clear some debt to unlock the bigger desks."
          : "Distressed. Repay what you owe before borrowing again.";
  return { score, grade, blurb };
}

export function isOverdue(loan: LoanRow, currentDay: number): boolean {
  return loan.status === "active" && currentDay > loan.due_day;
}

/** What one more in-game day of carrying this loan costs. */
export function dailyInterest(loan: LoanRow, currentDay: number): number {
  const rate = loan.daily_rate * (isOverdue(loan, currentDay) ? OVERDUE_MULTIPLIER : 1);
  return loan.balance * rate;
}

export async function fetchMyLoans(memberId: string): Promise<LoanRow[]> {
  const { data, error } = await supabase
    .from("company_loans")
    .select("*")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** The whole company's loan book - what the Bank page shows managers. */
export async function fetchCompanyLoans(companyId: string): Promise<LoanRow[]> {
  const { data, error } = await supabase
    .from("company_loans")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** A Frugal/Treasury perk holder borrows at a lower daily rate. */
export function discountedRate(offer: LoanOffer, rateDiscountPercent = 0): number {
  return offer.dailyRate * (1 - Math.min(90, rateDiscountPercent) / 100);
}

export async function takeLoan(params: {
  memberId: string;
  companyId: string;
  offer: LoanOffer;
  currentDay: number;
  existingLoans: LoanRow[];
  perkScoreBonus?: number;
  rateDiscountPercent?: number;
}): Promise<LoanRow> {
  const { memberId, companyId, offer, currentDay, existingLoans, perkScoreBonus = 0, rateDiscountPercent = 0 } = params;
  const { score } = creditRating(existingLoans, perkScoreBonus);
  if (score < offer.minScore) {
    throw new Error(`That desk needs a credit score of ${offer.minScore}; yours is ${score}.`);
  }
  if (existingLoans.some((l) => l.status === "active")) {
    throw new Error("Repay your current loan before opening another.");
  }

  const { data, error } = await supabase
    .from("company_loans")
    .insert({
      member_id: memberId,
      company_id: companyId,
      principal: offer.principal,
      balance: offer.principal,
      daily_rate: discountedRate(offer, rateDiscountPercent),
      term_days: offer.termDays,
      taken_on_day: currentDay,
      due_day: currentDay + offer.termDays,
      last_accrued_day: currentDay,
    })
    .select()
    .single();
  if (error) throw error;

  await awardMoney(memberId, offer.principal);
  return data;
}

export async function repayLoan(params: {
  loan: LoanRow;
  amount: number;
  currentMoney: number;
}): Promise<number> {
  const { loan, amount, currentMoney } = params;
  if (loan.status !== "active") throw new Error("That loan is already closed.");
  const payment = Math.min(amount, loan.balance, currentMoney);
  if (payment <= 0) throw new Error("Not enough money to make that payment.");

  const remaining = loan.balance - payment;
  // Rounding on the last payment: anything under a cent is settled.
  const settled = remaining < 0.01;
  const { error } = await supabase
    .from("company_loans")
    .update({
      balance: settled ? 0 : remaining,
      status: settled ? "repaid" : "active",
      closed_at: settled ? new Date().toISOString() : null,
    })
    .eq("id", loan.id);
  if (error) throw error;

  await awardMoney(loan.member_id, -payment);
  return payment;
}

/**
 * Charges every outstanding loan in the company for the in-game days that
 * have passed since it was last charged, and writes off anything left unpaid
 * a full term past its due date as a default.
 *
 * Run once from End Day rather than on read, so the balance a player sees is
 * the balance they owe - not something that drifts every time the page is
 * opened.
 */
export async function accrueInterest(companyId: string, currentDay: number): Promise<number> {
  const loans = (await fetchCompanyLoans(companyId)).filter(
    (l) => l.status === "active" && l.last_accrued_day < currentDay,
  );
  let totalCharged = 0;

  for (const loan of loans) {
    let balance = loan.balance;
    for (let day = loan.last_accrued_day + 1; day <= currentDay; day++) {
      balance *= 1 + loan.daily_rate * (day > loan.due_day ? OVERDUE_MULTIPLIER : 1);
    }
    const charged = balance - loan.balance;
    totalCharged += charged;

    const defaulted = currentDay > loan.due_day + loan.term_days + GRACE_DAYS;
    const { error } = await supabase
      .from("company_loans")
      .update({
        balance,
        interest_paid: loan.interest_paid + charged,
        last_accrued_day: currentDay,
        status: defaulted ? "defaulted" : "active",
        closed_at: defaulted ? new Date().toISOString() : null,
      })
      .eq("id", loan.id);
    if (error) throw error;
  }

  return totalCharged;
}
