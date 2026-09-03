import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LOAN_OFFERS,
  creditRating,
  dailyInterest,
  fetchCompanyLoans,
  isOverdue,
  repayLoan,
  takeLoan,
  type LoanOffer,
  type LoanRow,
} from "../lib/bank";
import { fetchCompanyMembers } from "../lib/company";
import { relativeTime } from "../lib/time";
import type { Database } from "../types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Company = Database["public"]["Tables"]["companies"]["Row"];

interface BankPageProps {
  profile: Profile;
  company: Company;
  onProfileChanged: () => void;
}

const money = (n: number) => `$${n.toFixed(2)}`;

export function BankPage({ profile, company, onProfileChanged }: BankPageProps) {
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [repayingLoan, setRepayingLoan] = useState<LoanRow | null>(null);
  const [repayAmount, setRepayAmount] = useState("");
  const [showBook, setShowBook] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [allLoans, companyMembers] = await Promise.all([
        fetchCompanyLoans(company.id),
        fetchCompanyMembers(company.id),
      ]);
      setLoans(allLoans);
      setMembers(companyMembers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reach the bank.");
    } finally {
      setLoading(false);
    }
  }, [company.id]);

  useEffect(() => {
    load();
  }, [load]);

  const myLoans = useMemo(() => loans.filter((l) => l.member_id === profile.id), [loans, profile.id]);
  const activeLoan = myLoans.find((l) => l.status === "active") ?? null;
  const rating = useMemo(() => creditRating(myLoans), [myLoans]);

  function memberName(id: string): string {
    if (id === profile.id) return "You";
    return members.find((m) => m.id === id)?.display_name ?? "A coworker";
  }

  function showStatus(message: string) {
    setStatus(message);
    setTimeout(() => setStatus(null), 4000);
  }

  async function handleTake(offer: LoanOffer) {
    setBusy(true);
    setError(null);
    try {
      await takeLoan({
        memberId: profile.id,
        companyId: company.id,
        offer,
        currentDay: company.current_day,
        existingLoans: myLoans,
      });
      showStatus(`${offer.emoji} ${money(offer.principal)} deposited. Due on Day ${company.current_day + offer.termDays}.`);
      await load();
      onProfileChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The desk turned you down.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRepay(loan: LoanRow, amount: number) {
    setBusy(true);
    setError(null);
    try {
      const paid = await repayLoan({ loan, amount, currentMoney: profile.money });
      showStatus(`Paid ${money(paid)} toward your loan.`);
      setRepayingLoan(null);
      setRepayAmount("");
      await load();
      onProfileChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't make that payment.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="flex-1 p-6 text-sm text-stone-400">Opening the vault…</div>;
  }

  const companyActive = loans.filter((l) => l.status === "active");
  const outstanding = companyActive.reduce((sum, l) => sum + l.balance, 0);
  const interestCharged = loans.reduce((sum, l) => sum + l.interest_paid, 0);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <div>
          <h1 className="text-lg font-semibold text-stone-900">🏦 Company Bank</h1>
          <p className="text-sm text-stone-500">
            Borrow against your future paperwork. Interest compounds every time the day is ended.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {/* Credit file */}
        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">📊 Your Credit File</h2>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <div>
              <p className="text-3xl font-semibold text-stone-900">{rating.grade}</p>
              <p className="text-xs text-stone-400">score {rating.score}/100</p>
            </div>
            <div className="min-w-0 flex-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
                <div
                  className={`h-full rounded-full ${rating.score >= 66 ? "bg-emerald-600" : rating.score >= 38 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${rating.score}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-stone-500">{rating.blurb}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-stone-500">
            <span>💰 Cash on hand: {money(profile.money)}</span>
            <span>✅ Loans repaid: {myLoans.filter((l) => l.status === "repaid").length}</span>
            <span>⚠️ Defaults: {myLoans.filter((l) => l.status === "defaulted").length}</span>
          </div>
        </section>

        {/* Your active loan */}
        {activeLoan && (
          <section
            className={`rounded-lg border p-4 ${
              isOverdue(activeLoan, company.current_day) ? "border-red-300 bg-red-50" : "border-amber-200 bg-amber-50"
            }`}
          >
            <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">
              {isOverdue(activeLoan, company.current_day) ? "🚨 Overdue Loan" : "📄 Your Open Loan"}
            </h2>
            <p className="mt-1 text-2xl font-semibold text-stone-900">{money(activeLoan.balance)}</p>
            <p className="text-xs text-stone-500">
              {money(activeLoan.principal)} borrowed on Day {activeLoan.taken_on_day} · due Day {activeLoan.due_day}
              {isOverdue(activeLoan, company.current_day) &&
                ` · ${company.current_day - activeLoan.due_day} day${company.current_day - activeLoan.due_day === 1 ? "" : "s"} late, accruing at double rate`}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              Next end-of-day charge: {money(dailyInterest(activeLoan, company.current_day))} ·{" "}
              {money(activeLoan.interest_paid)} in interest so far
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || profile.money <= 0}
                onClick={() => handleRepay(activeLoan, activeLoan.balance)}
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                Pay off in full ({money(Math.min(activeLoan.balance, profile.money))})
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setRepayingLoan(activeLoan);
                  setRepayAmount(String(Math.min(activeLoan.balance, profile.money).toFixed(2)));
                }}
                className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-50"
              >
                Pay part of it
              </button>
            </div>
            {profile.money < activeLoan.balance && (
              <p className="mt-2 text-xs text-stone-500">
                You're {money(activeLoan.balance - profile.money)} short of clearing it.
              </p>
            )}
          </section>
        )}

        {/* Loan desks */}
        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">💼 Loan Desks</h2>
          {activeLoan && (
            <p className="mt-1 text-xs text-stone-500">Repay your open loan to borrow again.</p>
          )}
          <ul className="mt-3 flex flex-col gap-2">
            {LOAN_OFFERS.map((offer) => {
              const locked = rating.score < offer.minScore;
              const total = offer.principal * (1 + offer.dailyRate) ** offer.termDays;
              return (
                <li
                  key={offer.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 ${
                    locked ? "border-stone-200 bg-stone-50 opacity-70" : "border-stone-200"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-stone-800">
                      {offer.emoji} {offer.label}
                    </p>
                    <p className="text-xs text-stone-500">
                      {money(offer.principal)} · {(offer.dailyRate * 100).toFixed(1)}%/day · {offer.termDays}-day term
                    </p>
                    <p className="text-xs text-stone-400">
                      Held the full term, you'd owe about {money(total)}.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy || locked || Boolean(activeLoan)}
                    onClick={() => handleTake(offer)}
                    className="shrink-0 rounded-md bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-900 disabled:opacity-40"
                  >
                    {locked ? `Needs ${offer.minScore}` : "Borrow"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Company loan book */}
        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">📚 Company Loan Book</h2>
            <button
              type="button"
              onClick={() => setShowBook((v) => !v)}
              className="text-xs font-medium text-stone-500 hover:text-stone-800"
            >
              {showBook ? "Hide" : "Show"} all {loans.length}
            </button>
          </div>
          <p className="mt-1 text-sm text-stone-600">
            {companyActive.length} open loan{companyActive.length === 1 ? "" : "s"} · {money(outstanding)} outstanding ·{" "}
            {money(interestCharged)} interest charged all-time
          </p>
          {showBook && (
            <ul className="mt-3 flex flex-col gap-1">
              {loans.length === 0 && <li className="text-sm text-stone-400">Nobody has borrowed yet.</li>}
              {loans.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-stone-50">
                  <span className="text-stone-700">
                    {memberName(l.member_id)} — {money(l.principal)}
                  </span>
                  <span className="text-xs text-stone-400">
                    {l.status === "active"
                      ? `${money(l.balance)} owed · due Day ${l.due_day}`
                      : l.status === "repaid"
                        ? `repaid ${l.closed_at ? relativeTime(l.closed_at) : ""}`
                        : "defaulted"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {repayingLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4" onClick={() => setRepayingLoan(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-stone-900">Make a payment</h2>
            <p className="mt-1 text-sm text-stone-500">
              {money(repayingLoan.balance)} owed · {money(profile.money)} on hand
            </p>
            <input
              type="number"
              min="0"
              step="0.01"
              autoFocus
              value={repayAmount}
              onChange={(e) => setRepayAmount(e.target.value)}
              className="mt-3 w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRepayingLoan(null)}
                className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !(Number(repayAmount) > 0)}
                onClick={() => handleRepay(repayingLoan, Number(repayAmount))}
                className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {busy ? "Paying…" : "Pay"}
              </button>
            </div>
          </div>
        </div>
      )}

      {status && (
        <div className="fixed bottom-4 right-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 shadow-lg">
          {status}
        </div>
      )}
    </div>
  );
}
