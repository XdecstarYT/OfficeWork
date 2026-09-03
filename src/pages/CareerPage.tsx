import { useCallback, useEffect, useMemo, useState } from "react";
import { CHAPTERS, type EndgameContext } from "../data/endgame";
import {
  canRetire,
  evaluateCompletion,
  fetchHallOfFame,
  fetchMyRetirements,
  finalScore,
  retire,
  titleForScore,
  RETIREMENT_MIN_CHAPTER,
  type CompletionSummary,
  type RetirementRow,
} from "../lib/legacy";
import { fetchCompanyDocumentStats, payoutForStat } from "../lib/documents";
import { fetchMyClaims } from "../lib/objectives";
import { fetchMyPerks, perkState } from "../lib/perks";
import { fetchDesk } from "../lib/desks";
import { creditRating, fetchMyLoans } from "../lib/bank";
import { fetchProjects } from "../lib/projects";
import { fetchMyContributionTotal } from "../lib/treasury";
import { fetchHoldings } from "../lib/stocks";
import { careerLevelFromXp } from "../lib/careerLevel";
import { postCorporateUpdate } from "../lib/corporateUpdates";
import { COSMETIC_BY_ID } from "../data/cosmetics";
import { relativeTime } from "../lib/time";
import type { Database } from "../types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Company = Database["public"]["Tables"]["companies"]["Row"];

interface CareerPageProps {
  profile: Profile;
  company: Company;
  onProfileChanged: () => void;
}

const EMPTY_CTX: EndgameContext = {
  completedByMe: 0,
  earned: 0,
  careerLevel: 1,
  money: 0,
  objectivesClaimed: 0,
  perkIds: [],
  cosmeticIds: [],
  filledSlots: 0,
  loansRepaid: 0,
  loansDefaulted: 0,
  creditScore: 0,
  projectsDelivered: 0,
  companyBadges: 0,
  treasuryContributed: 0,
  stocksOwned: 0,
};

export function CareerPage({ profile, company, onProfileChanged }: CareerPageProps) {
  const [ctx, setCtx] = useState<EndgameContext>(EMPTY_CTX);
  const [hallOfFame, setHallOfFame] = useState<RetirementRow[]>([]);
  const [myRetirements, setMyRetirements] = useState<RetirementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [retiring, setRetiring] = useState(false);
  const [farewell, setFarewell] = useState<RetirementRow | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [docs, claims, perks, desk, loans, projects, contributed, holdings, hof, mine] = await Promise.all([
        fetchCompanyDocumentStats(company.id),
        fetchMyClaims(profile.id),
        fetchMyPerks(profile.id),
        fetchDesk(profile.id),
        fetchMyLoans(profile.id),
        fetchProjects(company.id),
        fetchMyContributionTotal(company.id, profile.id),
        fetchHoldings(profile.id),
        fetchHallOfFame(company.id),
        fetchMyRetirements(profile.id),
      ]);

      const mineCompleted = docs.filter((d) => d.assigned_to === profile.id && d.status === "completed");
      const deliveredIds = new Set(projects.filter((p) => p.status === "completed").map((p) => p.id));
      // "Contributed to" means you completed at least one of its documents -
      // the same rule the bonus split uses.
      const projectsDelivered = new Set(
        mineCompleted.filter((d) => d.project_id && deliveredIds.has(d.project_id)).map((d) => d.project_id),
      ).size;

      // Only bought items count; the free starter set is on every desk.
      const boughtIds = desk.ownedItems.filter((id) => (COSMETIC_BY_ID.get(id)?.cost ?? 0) > 0);
      const filledSlots = new Set(boughtIds.map((id) => COSMETIC_BY_ID.get(id)?.slot).filter(Boolean)).size;

      const perkEffects = perkState(perks, profile.xp).effects;

      setCtx({
        completedByMe: mineCompleted.length,
        earned: mineCompleted.reduce((sum, d) => sum + payoutForStat(d), 0),
        careerLevel: careerLevelFromXp(profile.xp),
        money: profile.money,
        objectivesClaimed: claims.length,
        perkIds: perks,
        cosmeticIds: boughtIds,
        filledSlots,
        loansRepaid: loans.filter((l) => l.status === "repaid").length,
        loansDefaulted: loans.filter((l) => l.status === "defaulted").length,
        creditScore: creditRating(loans, perkEffects.creditScoreBonus).score,
        projectsDelivered,
        companyBadges: company.company_badges_claimed.length,
        treasuryContributed: contributed,
        stocksOwned: holdings.filter((h) => h.shares > 0).length,
      });
      setHallOfFame(hof);
      setMyRetirements(mine);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open your career file.");
    } finally {
      setLoading(false);
    }
  }, [company.id, company.company_badges_claimed.length, profile.id, profile.xp, profile.money]);

  useEffect(() => {
    load();
  }, [load]);

  const summary: CompletionSummary = useMemo(() => evaluateCompletion(ctx), [ctx]);
  const score = finalScore(ctx, summary.percent);
  const projectedTitle = titleForScore(score);
  const eligible = canRetire(summary);

  async function handleRetire() {
    setRetiring(true);
    setError(null);
    try {
      const record = await retire({
        memberId: profile.id,
        companyId: company.id,
        displayName: profile.display_name,
        companyName: company.name,
        ctx,
        summary,
      });
      // Posted before the profile refresh drops us out of the company, so the
      // company keeps a record of the send-off.
      await postCorporateUpdate({
        companyId: company.id,
        title: `🎓 ${profile.display_name} has retired`,
        body: `After ${ctx.completedByMe} document${ctx.completedByMe === 1 ? "" : "s"} and ${summary.done} of ${summary.total} career goals, ${profile.display_name} retires as ${record.final_title} with a final score of ${record.score.toLocaleString()}.`,
        postedBy: profile.id,
        category: "announcement",
      }).catch(() => {});
      setFarewell(record);
      setConfirming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't file your retirement.");
      setRetiring(false);
    }
  }

  if (loading) {
    return <div className="flex-1 p-6 text-sm text-stone-400">Pulling your career file…</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <div>
          <h1 className="text-lg font-semibold text-stone-900">🏁 Career</h1>
          <p className="text-sm text-stone-500">
            The long game: {summary.total} goals across every part of the office. Finish chapter{" "}
            {RETIREMENT_MIN_CHAPTER} and you can retire whenever you like.
          </p>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {/* Completion */}
        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-4xl font-semibold text-stone-900">{summary.percent}%</p>
              <p className="text-xs text-stone-400">
                {summary.done} of {summary.total} goals · Chapter {summary.currentChapter} of {CHAPTERS.length}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-stone-700">
                {projectedTitle.title} · {score.toLocaleString()} pts
              </p>
              <p className="text-xs text-stone-400">if you retired today</p>
            </div>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{ width: `${summary.percent}%` }}
            />
          </div>
        </section>

        {/* The ladder */}
        {CHAPTERS.map((chapter) => {
          const goals = summary.goals.filter((g) => g.goal.chapter === chapter.n);
          const cleared = goals.every((g) => g.done);
          const locked = chapter.n > summary.currentChapter;
          return (
            <section
              key={chapter.n}
              className={`rounded-lg border p-4 ${cleared ? "border-emerald-300 bg-emerald-50" : "border-stone-200 bg-white"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">
                  Chapter {chapter.n} — {chapter.name}
                </h2>
                <span className="text-xs text-stone-400">
                  {cleared ? "✓ Complete" : `${goals.filter((g) => g.done).length}/${goals.length}`}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-stone-400">{chapter.blurb}</p>

              <ul className={`mt-3 flex flex-col gap-2 ${locked ? "opacity-60" : ""}`}>
                {goals.map(({ goal, value, done, percent }) => (
                  <li key={goal.id} className="rounded-md border border-stone-200 bg-white p-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`text-sm ${done ? "text-stone-500 line-through" : "text-stone-800"}`}>
                        {done ? "✅" : goal.emoji} {goal.title}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-stone-400">
                        {goal.format
                          ? `${goal.format(Math.min(value, goal.target))} / ${goal.format(goal.target)}`
                          : `${Math.min(value, goal.target)} / ${goal.target}`}
                      </span>
                    </div>
                    {!done && (
                      <>
                        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-stone-100">
                          <div className="h-full rounded-full bg-stone-400" style={{ width: `${percent}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-stone-400">{goal.hint}</p>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {/* Retirement */}
        <section
          className={`rounded-lg border p-4 ${eligible ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-white"}`}
        >
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500">🎓 Retirement</h2>
          {eligible ? (
            <>
              <p className="mt-1 text-sm text-stone-700">
                You've done enough. Retiring files a permanent record of this career — {ctx.completedByMe} documents,{" "}
                {summary.done} goals, {score.toLocaleString()} points — into the Hall of Fame as{" "}
                <strong>{projectedTitle.title}</strong>, and starts you over with a fresh profile outside the company.
              </p>
              <p className="mt-1 text-xs text-stone-500">
                Your money, rank, perks and desk go with the old career. The record stays forever.
              </p>
              {confirming ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-stone-700">Retire for good?</span>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-white"
                  >
                    Not yet
                  </button>
                  <button
                    type="button"
                    disabled={retiring}
                    onClick={handleRetire}
                    className="rounded-md bg-amber-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
                  >
                    {retiring ? "Filing…" : "Retire"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="mt-3 rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
                >
                  🎓 Retire as {projectedTitle.title}
                </button>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-stone-500">
              Clear chapter {RETIREMENT_MIN_CHAPTER} to unlock retirement. You're on chapter {summary.currentChapter}.
            </p>
          )}
        </section>

        {/* Hall of fame */}
        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">🏛 Hall of Fame</h2>
          {hallOfFame.length === 0 ? (
            <p className="mt-2 text-sm text-stone-400">Nobody has retired from {company.name} yet.</p>
          ) : (
            <ol className="mt-2 flex flex-col gap-1">
              {hallOfFame.map((r, i) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-stone-50">
                  <span className="text-stone-700">
                    <span className="text-stone-400">#{i + 1}</span> {r.display_name} —{" "}
                    <span className="text-stone-500">{r.final_title}</span>
                  </span>
                  <span className="text-xs text-stone-400">
                    {r.score.toLocaleString()} pts · {r.completion_percent}% · {relativeTime(r.retired_at)}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {myRetirements.length > 0 && (
            <p className="mt-3 border-t border-stone-100 pt-3 text-xs text-stone-500">
              Your past careers: {myRetirements.map((r) => `${r.final_title} (${r.score.toLocaleString()})`).join(" · ")}
            </p>
          )}
        </section>
      </div>

      {farewell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-xl">
            <p className="text-5xl">🎓</p>
            <h2 className="mt-3 text-xl font-semibold text-stone-900">{farewell.final_title}</h2>
            <p className="mt-1 text-sm text-stone-500">
              {farewell.display_name} of {farewell.company_name}
            </p>
            <p className="mt-4 text-3xl font-semibold text-stone-900">{farewell.score.toLocaleString()}</p>
            <p className="text-xs text-stone-400">final score · {farewell.completion_percent}% complete</p>
            <p className="mt-4 text-sm italic text-stone-600">"{titleForScore(farewell.score).blurb}"</p>
            <button
              type="button"
              onClick={onProfileChanged}
              className="mt-6 w-full rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Start a new career
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
