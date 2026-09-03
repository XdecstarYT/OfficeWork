import { useCallback, useEffect, useMemo, useState } from "react";
import {
  claimObjective,
  evaluateObjectives,
  fetchMyClaims,
  objectivesFor,
  type ObjectiveProgress,
} from "../lib/objectives";
import { fetchCompanyDocumentStats } from "../lib/documents";
import { fetchMyPerks, perkState } from "../lib/perks";

interface ObjectivesPanelProps {
  memberId: string;
  companyId: string;
  /** Drives the perk reward bonus; also re-derives it as you level. */
  xp: number;
  /** Bumped by the parent when money/XP changed elsewhere. */
  onClaimed?: () => void;
}

export function ObjectivesPanel({ memberId, companyId, xp, onClaimed }: ObjectivesPanelProps) {
  const [objectives, setObjectives] = useState<ObjectiveProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingKey, setClaimingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [rewardBonusPercent, setRewardBonusPercent] = useState(0);

  // The set is a pure function of the company and today's date, so it is
  // stable across re-renders without a fetch.
  const defs = useMemo(() => objectivesFor(companyId), [companyId]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [docs, claims, perks] = await Promise.all([
        fetchCompanyDocumentStats(companyId),
        fetchMyClaims(memberId),
        fetchMyPerks(memberId),
      ]);
      setRewardBonusPercent(perkState(perks, xp).effects.objectiveRewardPercent);
      setObjectives(
        evaluateObjectives({
          defs,
          docs,
          memberId,
          claimedKeys: new Set(claims.map((c) => c.objective_key)),
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load objectives.");
    } finally {
      setLoading(false);
    }
  }, [companyId, memberId, defs, xp]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleClaim(objective: ObjectiveProgress) {
    setClaimingKey(objective.key);
    setError(null);
    try {
      const claim = await claimObjective({ memberId, companyId, objective, rewardBonusPercent });
      setFlash(`+$${claim.reward_money} · +${claim.reward_xp} XP`);
      setTimeout(() => setFlash(null), 2500);
      await load();
      onClaimed?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't claim that.");
    } finally {
      setClaimingKey(null);
    }
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">🎯 Objectives</h2>
        <p className="mt-2 text-sm text-stone-400">Loading objectives…</p>
      </section>
    );
  }

  const daily = objectives.filter((o) => o.period === "daily");
  const weekly = objectives.filter((o) => o.period === "weekly");
  const claimable = objectives.filter((o) => o.complete && !o.claimed).length;

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">🎯 Objectives</h2>
        <div className="flex items-center gap-2 text-xs">
          {flash && <span className="font-medium text-emerald-700">{flash}</span>}
          {claimable > 0 && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
              {claimable} ready to claim
            </span>
          )}
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {rewardBonusPercent > 0 && (
        <p className="mt-2 text-xs text-emerald-700">
          🌟 Your perks add +{rewardBonusPercent}% to every objective reward below.
        </p>
      )}

      <ObjectiveList
        heading="Today"
        objectives={daily}
        bonusPercent={rewardBonusPercent}
        claimingKey={claimingKey}
        onClaim={handleClaim}
      />
      <ObjectiveList
        heading="This Week"
        objectives={weekly}
        bonusPercent={rewardBonusPercent}
        claimingKey={claimingKey}
        onClaim={handleClaim}
      />
    </section>
  );
}

function ObjectiveList({
  heading,
  objectives,
  bonusPercent,
  claimingKey,
  onClaim,
}: {
  heading: string;
  objectives: ObjectiveProgress[];
  bonusPercent: number;
  claimingKey: string | null;
  onClaim: (objective: ObjectiveProgress) => void;
}) {
  if (objectives.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">{heading}</p>
      <ul className="mt-2 flex flex-col gap-2">
        {objectives.map((o) => {
          const pct = Math.round((o.progress / o.target) * 100);
          return (
            <li
              key={o.key}
              className={`rounded-md border p-3 ${
                o.claimed ? "border-stone-200 bg-stone-50 opacity-70" : o.complete ? "border-emerald-300 bg-emerald-50" : "border-stone-200"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-stone-800">
                    {o.emoji} {o.title}
                  </p>
                  <p className="text-xs text-stone-500">{o.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-medium text-emerald-700">
                    💵 ${Math.round(o.rewardMoney * (1 + bonusPercent / 100))} · ⭐{" "}
                    {Math.round(o.rewardXp * (1 + bonusPercent / 100))} XP
                  </p>
                  {o.claimed ? (
                    <span className="mt-1 inline-block text-xs text-stone-400">✓ Claimed</span>
                  ) : o.complete ? (
                    <button
                      type="button"
                      disabled={claimingKey === o.key}
                      onClick={() => onClaim(o)}
                      className="mt-1 rounded-md bg-emerald-700 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                    >
                      {claimingKey === o.key ? "Claiming…" : "Claim"}
                    </button>
                  ) : (
                    <span className="mt-1 inline-block text-xs text-stone-400">
                      {o.progress} / {o.target}
                    </span>
                  )}
                </div>
              </div>
              {!o.claimed && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
                  <div
                    className={`h-full rounded-full ${o.complete ? "bg-emerald-600" : "bg-stone-400"}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
