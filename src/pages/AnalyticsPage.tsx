import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchCompanyDocumentStats, payoutForStat, type DocumentStatRow } from "../lib/documents";
import { fetchCompanyMembers } from "../lib/company";
import { fetchCompanyNpcs } from "../lib/npcs";
import { downloadCsv } from "../lib/csv";
import { BarChart, DonutChart, HBarChart, LineChart, type Point } from "../components/charts";
import type { Database } from "../types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Company = Database["public"]["Tables"]["companies"]["Row"];

interface AnalyticsPageProps {
  profile: Profile;
  company: Company;
}

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 14, label: "14 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

const STATUS_COLORS: Record<string, string> = {
  completed: "#047857",
  approved: "#059669",
  pending_approval: "#d97706",
  submitted: "#0891b2",
  in_progress: "#6366f1",
  assigned: "#8b5cf6",
  requested: "#a8a29e",
  rejected: "#dc2626",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  quick: "#10b981",
  standard: "#f59e0b",
  detailed: "#f43f5e",
};

const money = (n: number) => `$${n.toFixed(2)}`;

/** Local midnight N days back, inclusive of today. */
function dayBuckets(days: number): { key: string; label: string; start: number; end: number }[] {
  const buckets = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const start = new Date(today);
    start.setDate(start.getDate() - i);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    buckets.push({
      key: start.toISOString(),
      label: `${start.getMonth() + 1}/${start.getDate()}`,
      start: start.getTime(),
      end: end.getTime(),
    });
  }
  return buckets;
}

export function AnalyticsPage({ profile, company }: AnalyticsPageProps) {
  const [docs, setDocs] = useState<DocumentStatRow[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [npcNames, setNpcNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rangeDays, setRangeDays] = useState(14);
  const [mineOnly, setMineOnly] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [d, m, npcs] = await Promise.all([
        fetchCompanyDocumentStats(company.id),
        fetchCompanyMembers(company.id),
        fetchCompanyNpcs(company.id),
      ]);
      setDocs(d);
      setMembers(m);
      setNpcNames(new Map(npcs.map((n) => [n.id, n.job_title])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load analytics.");
    } finally {
      setLoading(false);
    }
  }, [company.id]);

  useEffect(() => {
    load();
  }, [load]);

  const scoped = useMemo(
    () => (mineOnly ? docs.filter((d) => d.assigned_to === profile.id || d.created_by === profile.id) : docs),
    [docs, mineOnly, profile.id],
  );

  const buckets = useMemo(() => dayBuckets(rangeDays), [rangeDays]);
  const rangeStart = buckets[0]?.start ?? 0;

  const completedInRange = useMemo(
    () =>
      scoped.filter(
        (d) => d.status === "completed" && d.completed_at && new Date(d.completed_at).getTime() >= rangeStart,
      ),
    [scoped, rangeStart],
  );

  const throughput: Point[] = useMemo(
    () =>
      buckets.map((b) => ({
        label: b.label,
        value: completedInRange.filter((d) => {
          const t = new Date(d.completed_at as string).getTime();
          return t >= b.start && t < b.end;
        }).length,
      })),
    [buckets, completedInRange],
  );

  const earnings: Point[] = useMemo(
    () =>
      buckets.map((b) => ({
        label: b.label,
        value: Math.round(
          completedInRange
            .filter((d) => {
              const t = new Date(d.completed_at as string).getTime();
              return t >= b.start && t < b.end;
            })
            .reduce((sum, d) => sum + payoutForStat(d), 0),
        ),
      })),
    [buckets, completedInRange],
  );

  const createdVsCompleted: Point[] = useMemo(
    () =>
      buckets.map((b) => ({
        label: b.label,
        value: scoped.filter((d) => {
          const t = new Date(d.created_at).getTime();
          return t >= b.start && t < b.end;
        }).length,
      })),
    [buckets, scoped],
  );

  const workerName = useCallback(
    (doc: DocumentStatRow): string | null => {
      if (doc.assigned_to_npc_id) return `🤖 ${npcNames.get(doc.assigned_to_npc_id) ?? "AI Coworker"}`;
      if (!doc.assigned_to) return null;
      if (doc.assigned_to === profile.id) return profile.display_name;
      return members.find((m) => m.id === doc.assigned_to)?.display_name ?? null;
    },
    [npcNames, members, profile.id, profile.display_name],
  );

  const byWorker: Point[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of completedInRange) {
      const name = workerName(d);
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [completedInRange, workerName]);

  const earningsByWorker: Point[] = useMemo(() => {
    const totals = new Map<string, number>();
    for (const d of completedInRange) {
      const name = workerName(d);
      if (name) totals.set(name, (totals.get(name) ?? 0) + payoutForStat(d));
    }
    return [...totals.entries()]
      .map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [completedInRange, workerName]);

  const statusSlices = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of scoped) counts.set(d.status, (counts.get(d.status) ?? 0) + 1);
    return [...counts.entries()]
      .map(([label, value]) => ({ label: label.replace(/_/g, " "), value, color: STATUS_COLORS[label] ?? "#a8a29e" }))
      .sort((a, b) => b.value - a.value);
  }, [scoped]);

  const difficultySlices = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of completedInRange) {
      if (d.difficulty) counts.set(d.difficulty, (counts.get(d.difficulty) ?? 0) + 1);
    }
    return ["quick", "standard", "detailed"].map((k) => ({
      label: k,
      value: counts.get(k) ?? 0,
      color: DIFFICULTY_COLORS[k],
    }));
  }, [completedInRange]);

  /** Median hours from a task being created to being completed. */
  const turnaroundHours = useMemo(() => {
    const spans = completedInRange
      .map((d) => new Date(d.completed_at as string).getTime() - new Date(d.created_at).getTime())
      .filter((ms) => ms >= 0)
      .sort((a, b) => a - b);
    if (spans.length === 0) return null;
    const mid = Math.floor(spans.length / 2);
    const median = spans.length % 2 === 0 ? (spans[mid - 1] + spans[mid]) / 2 : spans[mid];
    return median / 3_600_000;
  }, [completedInRange]);

  const onTimeRate = useMemo(() => {
    const withDue = completedInRange.filter((d) => d.due_at);
    if (withDue.length === 0) return null;
    const onTime = withDue.filter(
      (d) => new Date(d.completed_at as string).getTime() <= new Date(d.due_at as string).getTime(),
    ).length;
    return Math.round((onTime / withDue.length) * 100);
  }, [completedInRange]);

  const totalEarned = completedInRange.reduce((sum, d) => sum + payoutForStat(d), 0);
  const openCount = scoped.filter((d) => d.status !== "completed").length;

  if (loading) {
    return <div className="flex-1 p-6 text-sm text-stone-400">Crunching the numbers…</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-stone-900">📊 Analytics</h1>
            <p className="text-sm text-stone-500">
              {company.name} · {docs.length} document{docs.length === 1 ? "" : "s"} on record
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              downloadCsv("analytics-daily.csv", [
                ["Date", "Created", "Completed", "Earned"],
                ...buckets.map((b, i) => [
                  b.label,
                  String(createdVsCompleted[i].value),
                  String(throughput[i].value),
                  String(earnings[i].value),
                ]),
              ])
            }
            className="shrink-0 rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
          >
            ⬇ Export CSV
          </button>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => setRangeDays(r.days)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                rangeDays === r.days ? "bg-stone-800 text-white" : "border border-stone-300 text-stone-600 hover:bg-stone-100"
              }`}
            >
              {r.label}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-xs text-stone-600">
            <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
            Just my work
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric emoji="✅" label="Completed" value={String(completedInRange.length)} sub={`in ${rangeDays} days`} />
          <Metric emoji="💵" label="Earned" value={money(totalEarned)} sub={`in ${rangeDays} days`} />
          <Metric
            emoji="⏱"
            label="Median turnaround"
            value={turnaroundHours === null ? "—" : turnaroundHours < 1 ? `${Math.round(turnaroundHours * 60)}m` : `${turnaroundHours.toFixed(1)}h`}
            sub="created → done"
          />
          <Metric
            emoji="🎯"
            label="On time"
            value={onTimeRate === null ? "—" : `${onTimeRate}%`}
            sub={onTimeRate === null ? "no due dates" : "of dated work"}
          />
        </div>

        <Card title="✅ Tasks completed per day">
          <LineChart points={throughput} valueLabel="tasks" />
        </Card>

        <Card title="💵 Payouts earned per day">
          <BarChart points={earnings} color="#047857" valueLabel="earned" formatValue={(v) => money(v)} />
        </Card>

        <Card title="📥 Work created per day" subtitle="Compare with completions above to see whether the backlog is growing.">
          <BarChart points={createdVsCompleted} color="#6366f1" valueLabel="created" />
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card title="📌 Pipeline by status" subtitle={`${openCount} still open`}>
            <DonutChart
              slices={statusSlices}
              centerLabel={String(scoped.length)}
              centerSub="documents"
            />
          </Card>
          <Card title="🎚 Completed by difficulty">
            <DonutChart
              slices={difficultySlices}
              centerLabel={String(completedInRange.length)}
              centerSub="completed"
            />
          </Card>
        </div>

        <Card title="🏅 Tasks completed by worker">
          <HBarChart points={byWorker} color="#4338ca" />
        </Card>

        <Card title="💰 Payouts earned by worker">
          <HBarChart points={earningsByWorker} color="#047857" formatValue={(v) => money(v)} />
        </Card>
      </div>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-stone-400">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Metric({ emoji, label, value, sub }: { emoji: string; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3">
      <p className="text-xs text-stone-400">
        {emoji} {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-stone-900">{value}</p>
      {sub && <p className="text-xs text-stone-400">{sub}</p>}
    </div>
  );
}
