import { useCallback, useEffect, useMemo, useState } from "react";
import { DeskScene, type DeskLook } from "../components/DeskScene";
import {
  COSMETICS,
  COSMETIC_BY_ID,
  FLOOR_STYLES,
  SLOT_META,
  WALL_STYLES,
  type CosmeticSlot,
} from "../data/cosmetics";
import { buyCosmetic, equipCosmetic, fetchCompanyDesks, fetchDesk, setDeskStyle, type Desk } from "../lib/desks";
import { fetchCompanyMembers } from "../lib/company";
import type { Database } from "../types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface DeskPageProps {
  profile: Profile;
  onProfileChanged: () => void;
}

export function DeskPage({ profile, onProfileChanged }: DeskPageProps) {
  const [desk, setDesk] = useState<Desk | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [otherDesks, setOtherDesks] = useState<Map<string, Desk>>(new Map());
  const [loading, setLoading] = useState(true);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<CosmeticSlot>("desk");
  const [visiting, setVisiting] = useState<Profile | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [mine, companyMembers, desks] = await Promise.all([
        fetchDesk(profile.id),
        profile.company_id ? fetchCompanyMembers(profile.company_id) : Promise.resolve([]),
        profile.company_id ? fetchCompanyDesks(profile.company_id) : Promise.resolve(new Map<string, Desk>()),
      ]);
      setDesk(mine);
      setMembers(companyMembers);
      setOtherDesks(desks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open your office.");
    } finally {
      setLoading(false);
    }
  }, [profile.id, profile.company_id]);

  useEffect(() => {
    load();
  }, [load]);

  function showStatus(message: string) {
    setStatus(message);
    setTimeout(() => setStatus(null), 3000);
  }

  const slotItems = useMemo(() => COSMETICS.filter((c) => c.slot === activeSlot), [activeSlot]);

  const ownedValue = useMemo(
    () => (desk?.ownedItems ?? []).reduce((sum, id) => sum + (COSMETIC_BY_ID.get(id)?.cost ?? 0), 0),
    [desk],
  );

  async function handleBuy(itemId: string) {
    if (!desk) return;
    setBusyItem(itemId);
    setError(null);
    try {
      const next = await buyCosmetic({
        desk,
        companyId: profile.company_id,
        itemId,
        currentMoney: profile.money,
      });
      setDesk(next);
      showStatus(`${COSMETIC_BY_ID.get(itemId)?.name} is yours — and on your desk.`);
      onProfileChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't buy that.");
    } finally {
      setBusyItem(null);
    }
  }

  async function handleEquip(itemId: string) {
    if (!desk) return;
    setBusyItem(itemId);
    setError(null);
    try {
      setDesk(await equipCosmetic({ desk, companyId: profile.company_id, itemId }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't put that out.");
    } finally {
      setBusyItem(null);
    }
  }

  async function handleStyle(patch: { wall?: string; floor?: string }) {
    if (!desk) return;
    setError(null);
    // Paint optimistically - a repaint that takes a round trip to show feels
    // broken, and there is nothing to lose if the write fails.
    const previous = desk;
    setDesk({ ...desk, ...patch });
    try {
      await setDeskStyle({ desk, companyId: profile.company_id, ...patch });
    } catch (err) {
      setDesk(previous);
      setError(err instanceof Error ? err.message : "Couldn't redecorate.");
    }
  }

  if (loading || !desk) {
    return <div className="flex-1 p-6 text-sm text-stone-400">Unlocking your office…</div>;
  }

  const look: DeskLook = { equipped: desk.equipped, wall: desk.wall, floor: desk.floor };
  const coworkers = members.filter((m) => m.id !== profile.id);
  const visitingLook: DeskLook | null = visiting
    ? (() => {
        const d = otherDesks.get(visiting.id);
        return d ? { equipped: d.equipped, wall: d.wall, floor: d.floor } : { equipped: {}, wall: "sand", floor: "oak" };
      })()
    : null;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-stone-900">🪑 Your Desk</h1>
            <p className="text-sm text-stone-500">
              {profile.display_name} · {profile.job_title} · 💵 ${profile.money.toFixed(2)} to spend
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-500">
            {desk.ownedItems.length} item{desk.ownedItems.length === 1 ? "" : "s"} · ${ownedValue} invested
          </span>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <section className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <DeskScene look={look} className="block h-auto w-full" />
        </section>

        {/* Paint and flooring */}
        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">🎨 Paint & Flooring</h2>
          <p className="mt-0.5 text-xs text-stone-400">Free — redecorate as often as you like.</p>
          <div className="mt-3 flex flex-col gap-3">
            <SwatchRow
              label="Walls"
              options={WALL_STYLES}
              selected={desk.wall}
              onSelect={(id) => handleStyle({ wall: id })}
            />
            <SwatchRow
              label="Floor"
              options={FLOOR_STYLES}
              selected={desk.floor}
              onSelect={(id) => handleStyle({ floor: id })}
            />
          </div>
        </section>

        {/* Shop */}
        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">🛍 Cosmetics Shop</h2>
          <p className="mt-0.5 text-xs text-stone-400">
            Pure decoration — none of this changes your payouts. The Office Shop on the Company tab is where money buys
            bonuses.
          </p>

          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {SLOT_META.map((slot) => (
              <button
                key={slot.id}
                type="button"
                onClick={() => setActiveSlot(slot.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                  activeSlot === slot.id
                    ? "bg-stone-800 text-white"
                    : "border border-stone-300 text-stone-600 hover:bg-stone-100"
                }`}
              >
                {slot.emoji} {slot.label}
              </button>
            ))}
          </div>

          <ul className="mt-3 flex flex-col gap-2">
            {slotItems.map((item) => {
              const owned = desk.ownedItems.includes(item.id);
              const equipped = desk.equipped[item.slot] === item.id;
              const affordable = item.cost <= profile.money;
              return (
                <li
                  key={item.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 ${
                    equipped ? "border-emerald-300 bg-emerald-50" : "border-stone-200"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-stone-800">
                      {item.emoji || (item.color ? "🎨" : "∅")} {item.name}
                    </p>
                    <p className="text-xs text-stone-500">{item.blurb}</p>
                  </div>
                  {equipped ? (
                    <span className="shrink-0 text-xs font-medium text-emerald-700">✓ On your desk</span>
                  ) : owned ? (
                    <button
                      type="button"
                      disabled={busyItem === item.id}
                      onClick={() => handleEquip(item.id)}
                      className="shrink-0 rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-50"
                    >
                      Put it out
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyItem === item.id || !affordable}
                      onClick={() => handleBuy(item.id)}
                      className="shrink-0 rounded-md bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-900 disabled:opacity-40"
                      title={affordable ? undefined : "Not enough money"}
                    >
                      {busyItem === item.id ? "Buying…" : `Buy $${item.cost}`}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* The floor */}
        {coworkers.length > 0 && (
          <section className="rounded-lg border border-stone-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">🚪 Wander the Floor</h2>
            <p className="mt-0.5 text-xs text-stone-400">Have a look at what your coworkers have done with the place.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {coworkers.map((m) => {
                const theirs = otherDesks.get(m.id);
                const theirLook: DeskLook = theirs
                  ? { equipped: theirs.equipped, wall: theirs.wall, floor: theirs.floor }
                  : { equipped: {}, wall: "sand", floor: "oak" };
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setVisiting(m)}
                    className="overflow-hidden rounded-lg border border-stone-200 text-left transition-shadow hover:shadow-md"
                  >
                    <DeskScene look={theirLook} className="block h-auto w-full" />
                    <p className="px-3 py-2 text-sm font-medium text-stone-800">
                      {m.display_name}
                      <span className="ml-1 text-xs font-normal text-stone-400">
                        {theirs ? m.job_title : "hasn't moved in yet"}
                      </span>
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {visiting && visitingLook && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
          onClick={() => setVisiting(null)}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <DeskScene look={visitingLook} className="block h-auto w-full" />
            <div className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-semibold text-stone-900">{visiting.display_name}</p>
                <p className="text-xs text-stone-500">
                  {visiting.job_title} · Rank {visiting.level}
                  {visiting.department && ` · ${visiting.department}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVisiting(null)}
                className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                Back to my desk
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

function SwatchRow({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: { id: string; label: string; color: string }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-12 shrink-0 text-xs text-stone-500">{label}</span>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onSelect(o.id)}
          title={o.label}
          aria-label={o.label}
          aria-pressed={selected === o.id}
          className={`h-8 w-8 rounded-md border-2 ${
            selected === o.id ? "border-stone-800" : "border-stone-200 hover:border-stone-400"
          }`}
          style={{ backgroundColor: o.color }}
        />
      ))}
    </div>
  );
}
