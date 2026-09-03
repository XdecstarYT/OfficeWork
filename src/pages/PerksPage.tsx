import { useCallback, useEffect, useMemo, useState } from "react";
import { PERKS, PERK_BRANCHES, type Perk, type PerkBranch } from "../data/perks";
import { fetchMyPerks, perkBlockedReason, perkState, respecPerks, takePerk } from "../lib/perks";
import { careerProgress } from "../lib/careerLevel";
import type { Database } from "../types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface PerksPageProps {
  profile: Profile;
  onProfileChanged: () => void;
}

const EFFECT_LABEL: Record<string, (v: number) => string> = {
  payoutBonusPercent: (v) => `+${v}% task payouts`,
  xpBonusPercent: (v) => `+${v}% XP`,
  objectiveRewardPercent: (v) => `+${v}% objective rewards`,
  loanRateDiscountPercent: (v) => `−${v}% loan interest`,
  creditScoreBonus: (v) => `+${v} credit score`,
  treasuryCutDiscountPercent: (v) => `−${v}% company cut`,
};

export function PerksPage({ profile, onProfileChanged }: PerksPageProps) {
  const [owned, setOwned] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmRespec, setConfirmRespec] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setOwned(await fetchMyPerks(profile.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your perks.");
    } finally {
      setLoading(false);
    }
  }, [profile.id]);

  useEffect(() => {
    load();
  }, [load]);

  const career = careerProgress(profile.xp);
  const state = useMemo(() => perkState(owned, profile.xp), [owned, profile.xp]);

  function showStatus(message: string) {
    setStatus(message);
    setTimeout(() => setStatus(null), 3000);
  }

  async function handleTake(perk: Perk) {
    setBusy(perk.id);
    setError(null);
    try {
      await takePerk({ memberId: profile.id, perkId: perk.id, xp: profile.xp, ownedIds: owned });
      showStatus(`${perk.emoji} ${perk.name} unlocked.`);
      await load();
      onProfileChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't take that perk.");
    } finally {
      setBusy(null);
    }
  }

  async function handleRespec() {
    setBusy("respec");
    setError(null);
    try {
      await respecPerks(profile.id);
      setConfirmRespec(false);
      showStatus("Perks cleared — all your points are back.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reset your perks.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <div className="flex-1 p-6 text-sm text-stone-400">Reviewing your file…</div>;
  }

  const activeEffects = Object.entries(state.effects).filter(([, v]) => v > 0);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-stone-900">🌟 Perks</h1>
            <p className="text-sm text-stone-500">
              One perk point per career level. Career Level {career.level} · {career.intoLevel}/{career.xpPerLevel} XP to
              the next.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-semibold text-stone-900">{state.available}</p>
            <p className="text-xs text-stone-400">
              point{state.available === 1 ? "" : "s"} to spend · {state.spent} spent
            </p>
          </div>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {activeEffects.length > 0 && (
          <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-700">Currently active</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {activeEffects.map(([key, value]) => (
                <span key={key} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-emerald-800">
                  {EFFECT_LABEL[key]?.(value as number) ?? `${key} +${value}`}
                </span>
              ))}
            </div>
          </section>
        )}

        {PERK_BRANCHES.map((branch) => (
          <Branch
            key={branch.id}
            branch={branch}
            perks={PERKS.filter((p) => p.branch === branch.id).sort((a, b) => a.tier - b.tier)}
            state={state}
            careerLevel={career.level}
            busy={busy}
            onTake={handleTake}
          />
        ))}

        {state.spent > 0 && (
          <div className="flex justify-end">
            {confirmRespec ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-500">Clear every perk and get all points back?</span>
                <button
                  type="button"
                  onClick={() => setConfirmRespec(false)}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
                >
                  Keep them
                </button>
                <button
                  type="button"
                  disabled={busy === "respec"}
                  onClick={handleRespec}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {busy === "respec" ? "Clearing…" : "Reset perks"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmRespec(true)}
                className="text-xs text-stone-400 hover:text-stone-700"
              >
                Reset my perks
              </button>
            )}
          </div>
        )}
      </div>

      {status && (
        <div className="fixed bottom-4 right-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 shadow-lg">
          {status}
        </div>
      )}
    </div>
  );
}

function Branch({
  branch,
  perks,
  state,
  careerLevel,
  busy,
  onTake,
}: {
  branch: { id: PerkBranch; name: string; emoji: string; blurb: string };
  perks: Perk[];
  state: ReturnType<typeof perkState>;
  careerLevel: number;
  busy: string | null;
  onTake: (perk: Perk) => void;
}) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">
        {branch.emoji} {branch.name}
      </h2>
      <p className="mt-0.5 text-xs text-stone-400">{branch.blurb}</p>

      <ol className="mt-3 flex flex-col gap-2">
        {perks.map((perk, i) => {
          const owned = state.owned.has(perk.id);
          const blocked = perkBlockedReason(perk, state, careerLevel);
          return (
            <li key={perk.id} className="flex items-stretch gap-3">
              {/* The spine that makes the tier order read as a chain. */}
              <div className="flex w-4 shrink-0 flex-col items-center">
                <span className={`h-2.5 w-2.5 rounded-full ${owned ? "bg-emerald-600" : "bg-stone-300"}`} />
                {i < perks.length - 1 && <span className={`w-0.5 flex-1 ${owned ? "bg-emerald-300" : "bg-stone-200"}`} />}
              </div>
              <div
                className={`mb-1 flex flex-1 flex-wrap items-center justify-between gap-3 rounded-md border p-3 ${
                  owned ? "border-emerald-300 bg-emerald-50" : blocked ? "border-stone-200 bg-stone-50 opacity-75" : "border-stone-200"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-stone-800">
                    {perk.emoji} {perk.name}
                    <span className="ml-2 text-xs font-normal text-stone-400">
                      Tier {perk.tier} · {perk.cost} pt{perk.cost === 1 ? "" : "s"}
                    </span>
                  </p>
                  <p className="text-xs text-stone-500">{perk.description}</p>
                </div>
                {owned ? (
                  <span className="shrink-0 text-xs font-medium text-emerald-700">✓ Unlocked</span>
                ) : (
                  <button
                    type="button"
                    disabled={Boolean(blocked) || busy === perk.id}
                    onClick={() => onTake(perk)}
                    className="shrink-0 rounded-md bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-900 disabled:opacity-40"
                  >
                    {busy === perk.id ? "Taking…" : (blocked ?? "Unlock")}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
