import { useCallback, useEffect, useState } from "react";
import { fetchCompanyMembers } from "../lib/company";
import { fetchCompanyDocuments } from "../lib/documents";
import { fetchCompanyNpcs } from "../lib/npcs";
import { careerLevelFromXp } from "../lib/careerLevel";
import { downloadCsv } from "../lib/csv";
import { supabase } from "../lib/supabaseClient";
import type { Database } from "../types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface LeaderboardPageProps {
  profile: Profile;
}

const MEDALS = ["🥇", "🥈", "🥉"];

interface Badge {
  emoji: string;
  label: string;
  earned: (stats: {
    completed: number;
    money: number;
    careerLevel: number;
    tenureDays: number;
    npcsHired: number;
  }) => boolean;
}

const BADGES: Badge[] = [
  { emoji: "🏁", label: "First Task", earned: (s) => s.completed >= 1 },
  { emoji: "💼", label: "Workhorse", earned: (s) => s.completed >= 10 },
  { emoji: "🏆", label: "Legend", earned: (s) => s.completed >= 50 },
  { emoji: "💰", label: "Well Off", earned: (s) => s.money >= 500 },
  { emoji: "💎", label: "Rich", earned: (s) => s.money >= 2000 },
  { emoji: "⭐", label: "Rising Star", earned: (s) => s.careerLevel >= 5 },
  { emoji: "🌟", label: "Veteran", earned: (s) => s.careerLevel >= 10 },
  { emoji: "📅", label: "One Month In", earned: (s) => s.tenureDays >= 30 },
  { emoji: "🤖", label: "Team Player", earned: (s) => s.npcsHired >= 1 },
];


function Rankings({
  title,
  rows,
  profile,
  formatValue,
}: {
  title: string;
  rows: { id: string; display_name: string; value: number }[];
  profile: Profile;
  formatValue: (v: number) => string;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-stone-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-stone-400">No data yet.</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {rows.map((r, i) => (
            <li
              key={r.id}
              className={`flex items-center justify-between rounded-md px-3 py-1.5 text-sm ${
                r.id === profile.id ? "bg-emerald-50" : ""
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-center">{MEDALS[i] ?? `#${i + 1}`}</span>
                <span className={r.id === profile.id ? "font-semibold text-emerald-800" : "text-stone-700"}>
                  {r.display_name} {r.id === profile.id && "(you)"}
                </span>
              </span>
              <span className="font-medium tabular-nums text-stone-600">{formatValue(r.value)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function LeaderboardPage({ profile }: LeaderboardPageProps) {
  const [members, setMembers] = useState<Profile[]>([]);
  const [completedCounts, setCompletedCounts] = useState<Record<string, number>>({});
  const [npcsHiredCounts, setNpcsHiredCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [departmentFilter, setDepartmentFilter] = useState("");

  const load = useCallback(async () => {
    if (!profile.company_id) return;
    setLoading(true);
    const [m, docs, npcs] = await Promise.all([
      fetchCompanyMembers(profile.company_id),
      fetchCompanyDocuments(profile.company_id),
      fetchCompanyNpcs(profile.company_id),
    ]);
    setMembers(m);
    const counts: Record<string, number> = {};
    for (const d of docs) {
      if (d.status === "completed" && d.assigned_to) {
        counts[d.assigned_to] = (counts[d.assigned_to] ?? 0) + 1;
      }
    }
    setCompletedCounts(counts);
    const hireCounts: Record<string, number> = {};
    for (const n of npcs) {
      hireCounts[n.hired_by] = (hireCounts[n.hired_by] ?? 0) + 1;
    }
    setNpcsHiredCounts(hireCounts);
    setLoading(false);
  }, [profile.company_id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!profile.company_id) return;
    const channel = supabase
      .channel(`leaderboard-${profile.company_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents", filter: `company_id=eq.${profile.company_id}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles", filter: `company_id=eq.${profile.company_id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.company_id, load]);

  if (loading) {
    return <div className="flex-1 p-6 text-sm text-stone-400">Loading leaderboard…</div>;
  }

  const byMoney = [...members]
    .map((m) => ({ id: m.id, display_name: m.display_name, value: m.money }))
    .sort((a, b) => b.value - a.value);

  const byCompleted = [...members]
    .map((m) => ({ id: m.id, display_name: m.display_name, value: completedCounts[m.id] ?? 0 }))
    .sort((a, b) => b.value - a.value);

  const byCareerLevel = [...members]
    .map((m) => ({ id: m.id, display_name: m.display_name, value: careerLevelFromXp(m.xp) }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-stone-900">🏆 Leaderboard</h1>
            <p className="text-sm text-stone-500">See how you stack up against your coworkers.</p>
          </div>
          <button
            type="button"
            onClick={() =>
              downloadCsv("leaderboard.csv", [
                ["Name", "Money", "Tasks Completed", "Career Level", "Department"],
                ...members.map((m) => [
                  m.display_name,
                  m.money.toFixed(2),
                  completedCounts[m.id] ?? 0,
                  careerLevelFromXp(m.xp),
                  m.department ?? "",
                ]),
              ])
            }
            className="shrink-0 rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
          >
            ⬇ Export CSV
          </button>
        </div>

        <Rankings title="💵 Richest" rows={byMoney} profile={profile} formatValue={(v) => `$${v.toFixed(2)}`} />
        <Rankings
          title="✅ Most Tasks Completed"
          rows={byCompleted}
          profile={profile}
          formatValue={(v) => `${v}`}
        />
        <Rankings
          title="⭐ Highest Career Level"
          rows={byCareerLevel}
          profile={profile}
          formatValue={(v) => `Lvl ${v}`}
        />

        <section className="flex flex-col gap-2 rounded-lg border border-stone-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">
              🎖 Achievements
            </h2>
            {new Set(members.map((m) => m.department).filter(Boolean)).size > 0 && (
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="rounded-md border border-stone-300 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none"
              >
                <option value="">All departments</option>
                {[...new Set(members.map((m) => m.department).filter((d): d is string => !!d))].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {members
              .filter((m) => !departmentFilter || m.department === departmentFilter)
              .map((m) => {
              const stats = {
                completed: completedCounts[m.id] ?? 0,
                money: m.money,
                careerLevel: careerLevelFromXp(m.xp),
                tenureDays: (Date.now() - new Date(m.created_at).getTime()) / 86_400_000,
                npcsHired: npcsHiredCounts[m.id] ?? 0,
              };
              const earned = BADGES.filter((b) => b.earned(stats));
              return (
                <div
                  key={m.id}
                  className={`flex flex-wrap items-center gap-2 rounded-md px-3 py-2 text-sm ${
                    m.id === profile.id ? "bg-emerald-50" : ""
                  }`}
                >
                  <span className={m.id === profile.id ? "font-semibold text-emerald-800" : "text-stone-700"}>
                    {m.display_name} {m.id === profile.id && "(you)"}
                  </span>
                  {m.department && (
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500">
                      {m.department}
                    </span>
                  )}
                  {earned.length === 0 ? (
                    <span className="text-xs text-stone-400">No badges yet.</span>
                  ) : (
                    earned.map((b) => (
                      <span
                        key={b.label}
                        title={b.label}
                        className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                      >
                        {b.emoji} {b.label}
                      </span>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
